import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidateQueries } from '../../hooks/useInvalidateQueries'
import { createPartner, deletePartner, setPartnerDesk } from '../../services/partners'
import { getAmenities } from '../../services/amenities'
import { isPendingFor } from '../../utils/mutationTarget'
import { normalizePartnerName } from '../../utils/deskPlans'
import { showToast } from '../../utils/toast'

// Partner organizations (9AM Games, DiiD, …). Members attached to one are
// booked on the org's desk automatically; a partner can only be removed once
// nobody is attached.
const PartnerRow = ({ partner, partnerNames, memberCount, desks, t, onRemove, onDeskChange, removing, savingDesk }) => (
  <li className="partner-row">
    <span className="partner-row-name">{partner.name}</span>
    <span className="partner-row-count">{t('adminPartners.memberCount', { count: memberCount })}</span>
    <select
      className="form-field partner-row-desk"
      aria-label={t('adminPartners.desk')}
      value={partner.deskAmenityId || ''}
      onChange={e => onDeskChange(partner, e.target.value || null)}
      disabled={savingDesk}
    >
      <option value="">{t('adminPartners.noDesk')}</option>
      {/* A deleted or no-longer-desk amenity would otherwise show as "No desk"
          while the partner still points at it and members get nothing. */}
      {partner.deskAmenityId && !desks.some(d => d.id === partner.deskAmenityId) && (
        <option value={partner.deskAmenityId}>{t('adminPartners.unknownDesk')}</option>
      )}
      {/* A desk is reserved for one partner at a time (reservedForPartnerId). */}
      {desks.map(desk => {
        const holder = desk.reservedForPartnerId !== partner.id && partnerNames[desk.reservedForPartnerId]
        return (
          <option key={desk.id} value={desk.id} disabled={!!holder}>
            {holder ? `${desk.name} (${holder})` : desk.name}
          </option>
        )
      })}
    </select>
    <button
      type="button"
      className="btn btn-danger btn-sm"
      onClick={() => onRemove(partner)}
      disabled={memberCount > 0 || removing}
      title={memberCount > 0 ? t('adminPartners.removeBlocked') : undefined}
    >
      {t('adminPartners.remove')}
    </button>
  </li>
)

const PartnersPanel = ({ partners, members, t }) => {
  const [name, setName] = useState('')
  const invalidate = useInvalidateQueries()

  const createMutation = useMutation({
    mutationFn: createPartner,
    onSuccess: () => {
      invalidate('partners')
      setName('')
    },
    onError: () => showToast(t('toast.partnerAddFailed'), 'error')
  })

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities,
    refetchOnWindowFocus: false,
    retry: 1
  })
  const desks = amenities.filter(a => a.type === 'desk')

  const deskMutation = useMutation({
    mutationFn: ({ id, deskAmenityId }) => setPartnerDesk(id, deskAmenityId),
    onSuccess: () => invalidate('partners', 'amenities'),
    onError: () => showToast(t('toast.partnerDeskFailed'), 'error')
  })

  const deleteMutation = useMutation({
    mutationFn: deletePartner,
    onSuccess: () => invalidate('partners', 'amenities'),
    onError: () => showToast(t('toast.partnerRemoveFailed'), 'error')
  })

  const handleAdd = (e) => {
    e.preventDefault()
    if (!name.trim() || createMutation.isPending) return
    // Duplicates would split members across two orgs ("9AM Games" / "9am games").
    if (partners.some(p => normalizePartnerName(p.name) === normalizePartnerName(name))) {
      showToast(t('toast.partnerDuplicate'), 'error')
      return
    }
    createMutation.mutate(name)
  }

  const handleRemove = (partner) => {
    if (isPendingFor(deleteMutation, partner.id)) return
    if (window.confirm(t('adminPartners.confirmRemove', { name: partner.name }))) {
      deleteMutation.mutate(partner.id)
    }
  }

  const handleDeskChange = (partner, deskAmenityId) => {
    if (isPendingFor(deskMutation, partner.id)) return
    deskMutation.mutate({ id: partner.id, deskAmenityId })
  }

  const partnerNames = Object.fromEntries(partners.map(p => [p.id, p.name]))
  const memberCount = (partnerId) => members.filter(m => m.partnerId === partnerId).length

  return (
    <section className="partners-panel glass">
      <div className="partners-panel-header">
        <h2 className="section-title">{t('adminPartners.title')}</h2>
        <p className="partners-panel-description">{t('adminPartners.description')}</p>
      </div>
      {partners.length === 0 ? (
        <p className="partners-empty">{t('adminPartners.empty')}</p>
      ) : (
        <ul className="partners-list">
          {partners.map(partner => (
            <PartnerRow
              key={partner.id}
              partner={partner}
              partnerNames={partnerNames}
              memberCount={memberCount(partner.id)}
              desks={desks}
              t={t}
              onRemove={handleRemove}
              onDeskChange={handleDeskChange}
              removing={isPendingFor(deleteMutation, partner.id)}
              savingDesk={isPendingFor(deskMutation, partner.id)}
            />
          ))}
        </ul>
      )}
      <form className="partners-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          className="form-field"
          placeholder={t('adminPartners.namePlaceholder')}
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || createMutation.isPending}>
          {createMutation.isPending ? t('common.saving') : t('adminPartners.add')}
        </button>
      </form>
    </section>
  )
}

export default PartnersPanel
