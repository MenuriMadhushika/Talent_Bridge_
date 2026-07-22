export function EmptyState({ title, body, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ text = "Loading…" }) {
  return <div className="loading-state">{text}</div>;
}
