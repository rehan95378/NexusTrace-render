export default function Panel({ title, hint, children }) {
  return (
    <section className="panel">
      {title && <h2>{title}</h2>}
      {hint && <p className="panel__hint">{hint}</p>}
      {children}
    </section>
  )
}
