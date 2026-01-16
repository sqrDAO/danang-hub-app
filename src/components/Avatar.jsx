import './Avatar.css'

const Avatar = ({ src, name, size = 'md', className = '' }) => {
  const getInitials = (name) => {
    if (!name) return '?'
    const names = name.trim().split(' ')
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase()
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
  }

  const getColorFromName = (name) => {
    if (!name) return 0
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return Math.abs(hash) % 360
  }

  const hasImage = src && src.trim() !== ''
  const initials = getInitials(name)
  const hue = getColorFromName(name)

  if (hasImage) {
    return (
      <img 
        src={src} 
        alt={name || 'User'}
        className={`avatar avatar-${size} ${className}`}
        onError={(e) => {
          e.target.style.display = 'none'
          e.target.nextSibling.style.display = 'flex'
        }}
      />
    )
  }

  return (
    <div 
      className={`avatar avatar-${size} avatar-initials ${className}`}
      style={{ '--avatar-hue': hue }}
      title={name}
    >
      {initials}
    </div>
  )
}

export default Avatar
