import { useTranslation } from 'react-i18next'
import { isMemberEmailVerified } from '../utils/memberEmail'
import './MemberEmail.css'

const MemberEmail = ({ member, link = false, className, fallback = '—' }) => {
  const { t } = useTranslation()
  if (!member?.email) return fallback
  return (
    <span className="member-email">
      {link
        ? <a href={`mailto:${member.email}`} className={className}>{member.email}</a>
        : <span>{member.email}</span>}
      <span className="member-email-status">
        {t(isMemberEmailVerified(member) ? 'memberEmail.verified' : 'memberEmail.unverified')}
      </span>
    </span>
  )
}

export default MemberEmail
