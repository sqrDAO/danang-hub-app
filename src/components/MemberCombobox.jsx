import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './MemberCombobox.css'

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

const watchSuggestions = (input, list, close) => {
  const position = () => {
    if (input.isConnected && list.isConnected) placeSuggestions(input, list)
  }
  const events = [
    [document, 'scroll', true], [window, 'resize'],
    [input.closest('dialog'), 'animationend'],
    [window.visualViewport, 'resize'], [window.visualViewport, 'scroll']
  ]
  events.forEach(([target, name, capture]) => target?.addEventListener(name, position, capture))
  const size = new ResizeObserver(position)
  size.observe(input)
  const visibility = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || entry.intersectionRatio < 0.99) close(false)
  }, { root: input.closest('.modal-body'), threshold: 1 })
  visibility.observe(input)
  position()
  return () => {
    events.forEach(([target, name, capture]) => target?.removeEventListener(name, position, capture))
    size.disconnect()
    visibility.disconnect()
  }
}

const useSuggestions = ({ open, inputRef, listRef, count, close }) => {
  useLayoutEffect(() => {
    if (!open) return undefined
    const list = listRef.current
    if (!list?.isConnected) return undefined
    list.showPopover?.()
    const stopWatching = watchSuggestions(inputRef.current, list, close)
    return () => {
      stopWatching()
      if (list.isConnected && list.matches(':popover-open')) list.hidePopover()
    }
  }, [open, inputRef, listRef, count, close])
}

const getSearchState = (open, disabled, count) => ({
  expanded: open && !disabled && count > 0,
  empty: open && !disabled && count === 0
})

const MemberCombobox = ({ members, memberId, onChange, disabled, label, placeholder }) => {
  const { t } = useTranslation()
  const id = useId()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = members.find(member => member.id === memberId)
  const matches = members.filter(member =>
    `${member.displayName || ''}\n${member.email || ''}`.toLowerCase().includes(query.toLowerCase()))
  const { expanded, empty } = getSearchState(open, disabled, matches.length)
  const activeIndex = Math.min(active, matches.length - 1)
  useSuggestions({ open: expanded, inputRef, listRef, count: matches.length, close: setOpen })

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
    } else if (expanded && event.key === 'Escape') {
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
        aria-controls={expanded ? `${id}-list` : undefined} aria-activedescendant={expanded ? `${id}-option-${activeIndex}` : undefined}
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
      {empty && (
        <p className="member-combobox-empty" role="status">{t('adminBookings.noMembersFound')}</p>
      )}
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
