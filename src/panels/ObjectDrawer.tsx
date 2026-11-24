import { useViewStore } from '../state/viewStore'
import { OBJECT_TYPE_LABEL } from '../data/types'
import { objectById, snippetById } from '../data'
import CodeBlock from './CodeBlock'

export default function ObjectDrawer() {
  const objectId = useViewStore((s) => s.objectId)
  const close = useViewStore((s) => s.closeObject)
  if (!objectId) return null

  const obj = objectById[objectId]
  if (!obj) return null
  const snippet = obj.snippetId ? snippetById[obj.snippetId] : undefined

  return (
    <>
      <div className="drawer-scrim" onClick={close} />
      <aside className="drawer">
        <header className="drawer-head">
          <div className="drawer-badges">
            <span className="type-badge" data-type={obj.type}>
              {OBJECT_TYPE_LABEL[obj.type]}
            </span>
          </div>
          <button type="button" className="drawer-close" onClick={close} aria-label="关闭">
            ✕
          </button>
        </header>

        <div className="drawer-scroll">
          <div className="drawer-techname">{obj.techName}</div>
          <h2 className="drawer-title">{obj.title}</h2>
          <p className="drawer-purpose">{obj.purpose}</p>

          {obj.params && obj.params.length > 0 && (
            <section className="drawer-sec">
              <h3>关键参数</h3>
              <dl className="param-list">
                {obj.params.map((p) => (
                  <div className="param-row" key={p.name}>
                    <dt>{p.name}</dt>
                    <dd>{p.desc}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {snippet && (
            <section className="drawer-sec">
              <h3>示例代码</h3>
              <CodeBlock code={snippet.body} lang={snippet.lang} title={snippet.title} />
              {snippet.notes && (
                <ul className="note-list">
                  {snippet.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {obj.pitfalls && obj.pitfalls.length > 0 && (
            <section className="drawer-sec">
              <h3>容易踩的坑</h3>
              <ul className="pitfall-list">
                {obj.pitfalls.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {obj.docs && obj.docs.length > 0 && (
            <section className="drawer-sec">
              <h3>官方文档</h3>
              <div className="doc-links">
                {obj.docs.map((d) => (
                  <a key={d.url} href={d.url} target="_blank" rel="noreferrer">
                    {d.label} ↗
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  )
}
