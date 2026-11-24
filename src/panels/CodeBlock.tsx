import { useMemo, useState } from 'react'
import { highlight } from '../lib/highlight'

type Props = {
  code: string
  lang: string
  title?: string
}

export default function CodeBlock({ code, lang, title }: Props) {
  const html = useMemo(() => highlight(code, lang), [code, lang])
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang">{lang.toUpperCase()}</span>
        {title && <span className="code-title">{title}</span>}
        <button type="button" className="code-copy" onClick={copy}>
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="code-body">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}
