import React, { useMemo, useRef, useState } from "react";

/**
 * MemoPhotoSearchApp
 * - キーワード検索
 * - メモ作成/削除
 * - 写真添付(複数)
 * - 2カラムの見やすいレイアウト
 */
export default function MemoPhotoSearchApp() {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pendingImages, setPendingImages] = useState([]);
  const [memos, setMemos] = useState([]);

  const imageInputRef = useRef(null);

  const handlePickImages = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const next = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingImages((prev) => [...prev, ...next]);
    event.target.value = "";
  };

  const removePendingImage = (id) => {
    setPendingImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((image) => image.id !== id);
    });
  };

  const addMemo = () => {
    if (!title.trim() && !content.trim() && pendingImages.length === 0) return;

    setMemos((prev) => [
      {
        id: crypto.randomUUID(),
        title: title.trim() || "（無題メモ）",
        content: content.trim(),
        createdAt: new Date().toISOString(),
        images: pendingImages,
      },
      ...prev,
    ]);

    setTitle("");
    setContent("");
    setPendingImages([]);
  };

  const removeMemo = (id) => {
    setMemos((prev) => {
      const target = prev.find((memo) => memo.id === id);
      target?.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return prev.filter((memo) => memo.id !== id);
    });
  };

  const filteredMemos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return memos;

    return memos.filter((memo) => {
      const text = `${memo.title} ${memo.content}`.toLowerCase();
      return text.includes(normalized);
    });
  }, [memos, query]);

  return (
    <div style={styles.page}>
      <section style={styles.editorPanel}>
        <h1 style={styles.heading}>メモボード</h1>
        <p style={styles.subHeading}>検索しやすく、写真付きで残せるメモアプリ</p>

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
                <img src={image.previewUrl} alt={image.file.name} style={styles.previewImage} />
                <button style={styles.removeImageButton} onClick={() => removePendingImage(image.id)}>
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
            placeholder="タイトル・本文を検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span style={styles.resultCount}>{filteredMemos.length}件</span>
        </div>

        <div style={styles.memoList}>
          {filteredMemos.length === 0 ? (
            <div style={styles.empty}>メモがありません。左から追加してください。</div>
          ) : (
            filteredMemos.map((memo) => (
              <article key={memo.id} style={styles.memoCard}>
                <div style={styles.memoHeader}>
                  <h2 style={styles.memoTitle}>{memo.title}</h2>
                  <button style={styles.deleteButton} onClick={() => removeMemo(memo.id)}>
                    削除
                  </button>
                </div>

                {memo.content && <p style={styles.memoContent}>{memo.content}</p>}

                {memo.images.length > 0 && (
                  <div style={styles.memoImageGrid}>
                    {memo.images.map((image) => (
                      <img
                        key={image.id}
                        src={image.previewUrl}
                        alt={image.file.name}
                        style={styles.memoImage}
                      />
                    ))}
                  </div>
                )}

                <time style={styles.time}>
                  {new Date(memo.createdAt).toLocaleString("ja-JP")}
                </time>
              </article>
            ))
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
    gridTemplateColumns: "minmax(300px, 420px) 1fr",
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
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
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
  resultCount: { color: "#64748b", fontSize: 13, fontWeight: 600 },
  memoList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflow: "auto",
    paddingRight: 4,
  },
  memoCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
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
  time: { fontSize: 12, color: "#94a3b8" },
};
