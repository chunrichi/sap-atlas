const ABAP_KEYWORDS = new Set(
  `DATA TYPES TYPE LIKE BEGIN END OF IF ELSE ELSEIF ENDIF CASE WHEN ENDCASE
   LOOP AT ENDLOOP INTO ASSIGNING FIELD-SYMBOL FIELD-SYMBOLS SELECT FROM WHERE
   AND OR NOT IS INITIAL TABLE ORDER BY APPENDING CORRESPONDING FIELDS
   CALL FUNCTION IMPORTING EXPORTING TABLES CHANGING RETURN RAISE
   TRY CATCH ENDTRY CLASS METHOD ENDMETHOD PUBLIC PRIVATE PROTECTED SECTION
   INTERFACES IMPLEMENTATION DEFINE END-OF-DEFINITION CONCATENATE WRITE MESSAGE
   COMMIT WORK ROLLBACK MODIFY INSERT UPDATE DELETE READ CLEAR MOVE ADD
   SUBTRACT MULTIPLY DIVIDE CONSTANTS VALUE NEW REF TO ABAP_TRUE ABAP_FALSE
   INNER JOIN LEFT OUTER ON GROUP HAVING COUNT SUM AVG MAX MIN
   METHODS REDEFINITION CREATE FINAL ABSTRACT ALIAS FOR ALL ENTRIES`
    .split(/\s+/)
    .filter(Boolean),
)

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function hlAbap(src: string): string {
  let out = ''
  let i = 0
  const n = src.length
  let lineStart = true

  while (i < n) {
    const c = src[i]

    if (c === '"') {
      let j = i
      while (j < n && src[j] !== '\n') j++
      out += `<span class="tok-com">${esc(src.slice(i, j))}</span>`
      i = j
      continue
    }

    if (lineStart && c === '*') {
      let j = i
      while (j < n && src[j] !== '\n') j++
      out += `<span class="tok-com">${esc(src.slice(i, j))}</span>`
      i = j
      continue
    }

    if (c === '\n') {
      out += '\n'
      i++
      lineStart = true
      continue
    }

    if (c === "'" || c === '`') {
      const q = c
      let j = i + 1
      while (j < n) {
        if (src[j] === q) {
          if (src[j + 1] === q) {
            j += 2
            continue
          }
          j++
          break
        }
        if (src[j] === '\n') break
        j++
      }
      out += `<span class="tok-str">${esc(src.slice(i, j))}</span>`
      i = j
      lineStart = false
      continue
    }

    if (c === '|') {
      let j = i + 1
      while (j < n && src[j] !== '|' && src[j] !== '\n') j++
      if (j < n && src[j] === '|') j++
      out += `<span class="tok-str">${esc(src.slice(i, j))}</span>`
      i = j
      lineStart = false
      continue
    }

    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < n && /[A-Za-z0-9_-]/.test(src[j])) j++
      const w = src.slice(i, j)
      const up = w.toUpperCase()
      if (ABAP_KEYWORDS.has(up)) out += `<span class="tok-kw">${esc(w)}</span>`
      else if (/^sy-/i.test(w)) out += `<span class="tok-sys">${esc(w)}</span>`
      else if (/^[a-z]{1,2}[cz]_/i.test(w)) out += `<span class="tok-cls">${esc(w)}</span>`
      else out += esc(w)
      i = j
      lineStart = false
      continue
    }

    if (/[0-9]/.test(c)) {
      let j = i
      while (j < n && /[0-9.]/.test(src[j])) j++
      out += `<span class="tok-num">${esc(src.slice(i, j))}</span>`
      i = j
      lineStart = false
      continue
    }

    out += esc(c)
    if (c !== ' ' && c !== '\t') lineStart = false
    i++
  }

  return out
}

function hlGeneric(src: string): string {
  return src
    .split('\n')
    .map((line) => {
      const safe = esc(line)
      if (/^\s*[#/]/.test(line)) return `<span class="tok-com">${safe}</span>`
      if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/.test(line)) {
        return `<span class="tok-kw">${safe}</span>`
      }
      if (/^[A-Za-z-]+:/.test(line)) {
        const idx = line.indexOf(':')
        return `<span class="tok-cls">${esc(line.slice(0, idx + 1))}</span>${esc(line.slice(idx + 1))}`
      }
      return safe
        .replace(/(&quot;.*?&quot;|".*?")/g, '<span class="tok-str">$1</span>')
        .replace(/\b(true|false|null)\b/g, '<span class="tok-kw">$1</span>')
        .replace(/\b\d+(\.\d+)?\b/g, '<span class="tok-num">$&</span>')
    })
    .join('\n')
}

export function highlight(code: string, lang: string): string {
  if (lang === 'abap') return hlAbap(code)
  return hlGeneric(code)
}
