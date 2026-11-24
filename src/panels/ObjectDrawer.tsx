import { useViewStore } from '../state/viewStore'
import { OBJECT_TYPE_LABEL } from '../data/types'
import { objectById, snippetById, stepById, summarizeUsage } from '../data'
import { useNavigate } from '../canvas/hooks/useNavigate'
import CodeBlock from './CodeBlock'

export default function ObjectDrawer() {
  const objectId = useViewStore((s) => s.objectId)
  const close = useViewStore((s) => s.closeObject)
  const setImpact = useViewStore((s) => s.setImpactObject)
  const { goStep } = useNavigate()

  if (!objectId) return null

  const obj = objectById[objectId]
  if (!obj) return null
  const snippet = obj.snippetId ? snippetById[obj.snippetId] : undefined

  // 同一对象可能被同一步骤的多个流程实例引用，抽屉里按「流程 + 步骤」去重
  const usage = summarizeUsage(obj.id)
  const seen = new Set<string>()
  const usages = usage.list.filter((u) => {
    const key = `${u.process.id}@${u.step.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const focusOnMap = () => {
    setImpact(obj.id)
    close()
    // 如果当前选中的步骤并不用这个对象（比如从搜索直接打开对象），
    // 先落到第一个引用它的步骤，否则用户会看到一屏被压暗、却没有任何高亮
    const current = useViewStore.getState().selectedStepId
    const onScreen = current ? stepById[current]?.objectIds.includes(obj.id) : false
    if (!onScreen && usages[0]) goStep(usages[0].process.id, usages[0].step.id)
  }

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

          {usages.length > 0 && (
            <div className="drawer-usage">
              <div className="drawer-usage-stat">
                被 <b>{usage.stepCount}</b> 个步骤引用 · <b>{usage.processCount}</b> 条流程 ·{' '}
                <b>{usage.moduleCount}</b> 个模块
              </div>
              <button type="button" className="drawer-impact-btn" onClick={focusOnMap}>
                在图上查看影响 <kbd>I</kbd>
              </button>
            </div>
          )}

          {usages.length > 0 && (
            <section className="drawer-sec">
              <h3>被引用于</h3>
              <div className="usage-list">
                {usages.map((u) => (
                  <button
                    type="button"
                    key={`${u.process.id}-${u.step.id}`}
                    className="usage-row"
                    style={{ ['--accent' as string]: u.module.accent }}
                    onClick={() => {
                      setImpact(null)
                      close()
                      goStep(u.process.id, u.step.id)
                    }}
                    title={`跳到 ${u.module.name} / ${u.process.name} 的「${u.step.name}」`}
                  >
                    <span className="usage-mod">{u.module.code}</span>
                    <span className="usage-main">
                      <b>{u.step.name}</b>
                      <em>
                        {u.process.name}
                        {u.step.tcode ? ` · ${u.step.tcode}` : ''}
                      </em>
                    </span>
                    <span className="usage-go">↗</span>
                  </button>
                ))}
              </div>
            </section>
          )}

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
