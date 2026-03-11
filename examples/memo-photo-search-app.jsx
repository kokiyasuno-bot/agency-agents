import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "memo-photo-search-app:v2";
const CHANNEL_NAME = "memo-photo-search-app-sync";
const DEFAULT_CATEGORY = "未分類";

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeText = (value = "") => value.normalize("NFKC").toLowerCase();

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    reader.readAsDataURL(file);
  });

/**
 * MemoPhotoSearchApp
 * - 複数タブ同期(localStorage + storageイベント + BroadcastChannel)
 * - カテゴリ追加/分類（フォルダ風表示）
 * - 強化検索（空白区切りAND検索 + 正規化）
 * - 写真付きメモ
 */
export default function MemoPhotoSearchApp() {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pendingImages, setPendingImages] = useState([]);
  const [memos, setMemos] = useState([]);
  const [categories, setCategories] = useState([DEFAULT_CATEGORY]);
  const [newCategory, setNewCategory] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all");

  const imageInputRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setMemos(parsed.memos || []);
      setCategories(parsed.categories?.length ? parsed.categories : [DEFAULT_CATEGORY]);
    }

    if (typeof BroadcastChannel !== "undefined") {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current.onmessage = (event) => {
        const next = event.data;
        if (!next) return;
        setMemos(next.memos || []);
        setCategories(next.categories?.length ? next.categories : [DEFAULT_CATEGORY]);
      };
    }

    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      const next = JSON.parse(event.newValue);
      setMemos(next.memos || []);
      setCategories(next.categories?.length ? next.categories : [DEFAULT_CATEGORY]);
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channelRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({ memos, categories });
    localStorage.setItem(STORAGE_KEY, payload);
    channelRef.current?.postMessage({ memos, categories });
  }, [memos, categories]);

  const handlePickImages = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const next = await Promise.all(
      files.map(async (file) => ({
        id: makeId(),
        name: file.name,
        dataUrl: await fileToDataUrl(file),
      }))
    );

    setPendingImages((prev) => [...prev, ...next]);
    event.target.value = "";
  };

  const addCategory = () => {
    const normalized = newCategory.trim();
    if (!normalized) return;
    if (categories.some((c) => normalizeText(c) === normalizeText(normalized))) {
      setNewCategory("");
      setSelectedCategory(normalized);
      return;
    }
    setCategories((prev) => [...prev, normalized]);
    setSelectedCategory(normalized);
    setNewCategory("");
  };

  const addMemo = () => {
    if (!title.trim() && !content.trim() && pendingImages.length === 0) return;

    const category = selectedCategory || DEFAULT_CATEGORY;
    if (!categories.includes(category)) setCategories((prev) => [...prev, category]);

    setMemos((prev) => [
      {
        id: makeId(),
        title: title.trim() || "（無題メモ）",
        content: content.trim(),
        createdAt: new Date().toISOString(),
        category,
        images: pendingImages,
      },
      ...prev,
    ]);

    setTitle("");
    setContent("");
    setPendingImages([]);
  };

  const removeMemo = (id) => {
    setMemos((prev) => prev.filter((memo) => memo.id !== id));
  };

  const filteredMemos = useMemo(() => {
    const terms = normalizeText(query)
      .split(/\s+/)
      .filter(Boolean);

    return memos.filter((memo) => {
      if (activeCategoryFilter !== "all" && memo.category !== activeCategoryFilter) return false;
      if (!terms.length) return true;

      const target = normalizeText(
        [
          memo.title,
          memo.content,
          memo.category,
          new Date(memo.createdAt).toLocaleString("ja-JP"),
          ...(memo.images || []).map((image) => image.name),
        ].join(" ")
      );

      return terms.every((term) => target.includes(term));
    });
  }, [activeCategoryFilter, memos, query]);

  const groupedMemos = useMemo(() => {
    const buckets = new Map();
    categories.forEach((category) => buckets.set(category, []));
    filteredMemos.forEach((memo) => {
      const key = memo.category || DEFAULT_CATEGORY;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(memo);
    });
    return buckets;
  }, [categories, filteredMemos]);

  return (
    <div style={styles.page}>
      <section style={styles.editorPanel}>
        <h1 style={styles.heading}>メモボード</h1>
        <p style={styles.subHeading}>タブ同期 / カテゴリ管理 / 写真付きメモ / 強化検索</p>

        <label style={styles.label}>カテゴリ（フォルダ）</label>
        <div style={styles.inlineRow}>
          <select
            style={styles.select}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            style={styles.input}
            placeholder="新規カテゴリ名"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button style={styles.secondaryButton} onClick={addCategory}>
            追加
          </button>
        </div>

        <label style={styles.label}>タイトル</label>
        <input
          style={styles.input}
          placeholder="例: 買い物メモ"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label style={styles.label}>本文</label>
        <textarea
          style={styles.textarea}
          placeholder="メモを入力してください"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div style={styles.photoActions}>
          <button style={styles.secondaryButton} onClick={() => imageInputRef.current?.click()}>
            写真を追加
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handlePickImages}
          />
          <button style={styles.primaryButton} onClick={addMemo}>
            メモを保存
          </button>
        </div>

        {pendingImages.length > 0 && (
          <div style={styles.previewGrid}>
            {pendingImages.map((image) => (
              <figure key={image.id} style={styles.previewCard}>
                <img src={image.dataUrl} alt={image.name} style={styles.previewImage} />
                <button
                  style={styles.removeImageButton}
                  onClick={() => setPendingImages((prev) => prev.filter((v) => v.id !== image.id))}
                >
                  ×
                </button>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section style={styles.listPanel}>
        <div style={styles.searchWrap}>
          <input
            style={styles.searchInput}
            placeholder="AND検索: 例）買い物 レシート 2026"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            style={styles.filterSelect}
            value={activeCategoryFilter}
            onChange={(e) => setActiveCategoryFilter(e.target.value)}
          >
            <option value="all">すべて</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <span style={styles.resultCount}>{filteredMemos.length}件</span>
        </div>

        <div style={styles.memoList}>
          {[...groupedMemos.entries()].map(([category, list]) => (
            <details key={category} open={activeCategoryFilter === "all" || activeCategoryFilter === category}>
              <summary style={styles.folderSummary}>📁 {category} ({list.length})</summary>
              {list.length === 0 ? (
                <div style={styles.emptySmall}>このカテゴリのメモはありません</div>
              ) : (
                list.map((memo) => (
                  <article key={memo.id} style={styles.memoCard}>
                    <div style={styles.memoHeader}>
                      <h2 style={styles.memoTitle}>{memo.title}</h2>
                      <button style={styles.deleteButton} onClick={() => removeMemo(memo.id)}>
                        削除
                      </button>
                    </div>

                    {memo.content && <p style={styles.memoContent}>{memo.content}</p>}

                    {memo.images?.length > 0 && (
                      <div style={styles.memoImageGrid}>
                        {memo.images.map((image) => (
                          <img key={image.id} src={image.dataUrl} alt={image.name} style={styles.memoImage} />
                        ))}
                      </div>
                    )}

                    <time style={styles.time}>{new Date(memo.createdAt).toLocaleString("ja-JP")}</time>
                  </article>
                ))
              )}
            </details>
          ))}

          {filteredMemos.length === 0 && (
            <div style={styles.empty}>該当するメモがありません。検索語やカテゴリを見直してください。</div>
          )}
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fbff 0%, #f2f6ff 100%)",
    color: "#1f2937",
    display: "grid",
    gridTemplateColumns: "minmax(340px, 480px) 1fr",
    gap: 20,
    padding: 20,
    boxSizing: "border-box",
    fontFamily:
      "Inter, 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  editorPanel: {
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 8px 24px rgba(30, 58, 138, 0.08)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  listPanel: {
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 8px 24px rgba(30, 58, 138, 0.08)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  },
  heading: { margin: 0, fontSize: 24 },
  subHeading: { margin: 0, color: "#64748b", fontSize: 14 },
  label: { fontSize: 13, fontWeight: 600, marginTop: 4 },
  inlineRow: { display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 8 },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
  },
  select: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
  },
  textarea: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    minHeight: 120,
    fontSize: 14,
    resize: "vertical",
  },
  photoActions: { display: "flex", gap: 10, marginTop: 8 },
  primaryButton: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#e2e8f0",
    color: "#0f172a",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  previewGrid: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
    gap: 8,
  },
  previewCard: {
    margin: 0,
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
    height: 90,
    background: "#e2e8f0",
  },
  previewImage: { width: "100%", height: "100%", objectFit: "cover" },
  removeImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
    border: "none",
    background: "rgba(15, 23, 42, 0.7)",
    color: "white",
    borderRadius: "999px",
    width: 22,
    height: 22,
    cursor: "pointer",
  },
  searchWrap: { display: "flex", gap: 8, alignItems: "center" },
  searchInput: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    flex: 1,
    minWidth: 0,
  },
  filterSelect: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 8px",
    background: "#fff",
  },
  resultCount: { color: "#64748b", fontSize: 13, fontWeight: 600 },
  memoList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflow: "auto",
    paddingRight: 4,
  },
  folderSummary: {
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 8,
    background: "#eef2ff",
    padding: "8px 10px",
    borderRadius: 10,
    listStyle: "none",
  },
  memoCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 10,
  },
  memoHeader: { display: "flex", justifyContent: "space-between", gap: 8 },
  memoTitle: { margin: 0, fontSize: 17 },
  memoContent: { margin: 0, color: "#334155", whiteSpace: "pre-wrap" },
  memoImageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 8,
  },
  memoImage: {
    width: "100%",
    height: 120,
    objectFit: "cover",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },
  deleteButton: {
    border: "none",
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  empty: {
    textAlign: "center",
    color: "#94a3b8",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 20,
  },
  emptySmall: {
    marginBottom: 10,
    color: "#94a3b8",
    fontSize: 13,
  },
  time: { fontSize: 12, color: "#94a3b8" },
};
