import { useId, useLayoutEffect, useRef, useState } from 'react'

// A top-layer popover uses viewport coordinates even inside a filtered dialog.
const placeSuggestions = (input, list) => {
  const rect = input.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - 12
  const above = rect.top - 12
  const upward = below < Math.min(220, list.scrollHeight) && above > below
  const height = Math.max(0, Math.min(220, upward ? above : below))
  const width = Math.min(rect.width, window.innerWidth - 16)
  Object.assign(list.style, {
    width: `${width}px`,
    maxHeight: `${height}px`,
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
    top: `${upward ? rect.top - Math.min(height, list.scrollHeight) - 4 : rect.bottom + 4}px`
  })
}

const useSuggestions = (open, inputRef, listRef) => {
  useLayoutEffect(() => {
    if (!open) return undefined
    const list = listRef.current
    if (!list?.isConnected) return undefined
    list.showPopover?.()
    let frame
    // Follow dialog entry animation, scroll, viewport resize and layout changes.
    const position = () => {
      if (!list.isConnected || !inputRef.current) return
      placeSuggestions(inputRef.current, list)
      frame = requestAnimationFrame(position)
    }
    position()
    return () => {
      cancelAnimationFrame(frame)
      if (list.isConnected && list.matches(':popover-open')) list.hidePopover()
    }
  }, [open, inputRef, listRef])
}

const MemberCombobox = ({ members, memberId, onChange, disabled, label, placeholder }) => {
  const id = useId()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = members.find(member => member.id === memberId)
  const matches = members.filter(member =>
    `${member.displayName || ''}\n${member.email || ''}`.toLowerCase().includes(query.toLowerCase()))
  const expanded = open && !disabled && matches.length > 0
  const activeIndex = Math.min(active, matches.length - 1)
  useSuggestions(expanded, inputRef, listRef)

  const select = (member) => {
    onChange(member.id)
    setQuery('')
    setOpen(false)
    inputRef.current.focus()
  }

  const handleKeyDown = (event) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(expanded ? (activeIndex + step + matches.length) % Math.max(1, matches.length) : 0)
    } else if (expanded && event.key === 'Enter') {
      event.preventDefault()
      select(matches[activeIndex])
    } else if (open && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }

  useLayoutEffect(() => {
    if (expanded) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [expanded, activeIndex, id])

  return (
    <div className="form-group member-combobox">
      <label className="form-label" htmlFor={id}>{label}</label>
      <input
        ref={inputRef} id={id} type="text" role="combobox" className="form-field"
        aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={expanded}
        aria-controls={`${id}-list`} aria-activedescendant={expanded ? `${id}-option-${activeIndex}` : undefined}
        placeholder={placeholder} autoComplete="off" disabled={disabled}
        value={query || selected?.displayName || selected?.email || ''}
        onChange={event => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(event.target.value.length > 0)
          onChange('')
        }}
        onKeyDown={handleKeyDown} onBlur={() => setOpen(false)}
      />
      {expanded && (
        <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={label}
          popover="manual" className="member-combobox-list"
          onPointerDown={event => event.preventDefault()}
        >
          {matches.map((member, index) => (
            <li key={member.id} id={`${id}-option-${index}`} role="option"
              aria-selected={index === activeIndex}
              className={`member-combobox-option${index === activeIndex ? ' selected' : ''}`}
              onClick={() => select(member)}
            >
              <span className="member-combobox-name">{member.displayName || member.email}</span>
              {member.displayName && member.email && <span className="member-combobox-email">{member.email}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MemberCombobox
