import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidateQueries } from '../../hooks/useInvalidateQueries'
import { PARTNER_DESK_TAKEN, createPartner, deletePartner, setPartnerDesk } from '../../services/partners'
import { getAmenities } from '../../services/amenities'
import { isPendingFor } from '../../utils/mutationTarget'
import { normalizePartnerName } from '../../utils/deskPlans'
import { showToast } from '../../utils/toast'

// Partner organizations (9AM Games, DiiD, …). Each has one desk, picked when
// it is added; members attached to it are booked on that desk automatically.
// Removing a partner detaches its members.

// Desks a partner may pick: any desk not reserved for another partner that
// still exists (a hold left by a deleted partner is free; see partners.js).
const desksOpenTo = (desks, partners, partnerId = null) => desks.filter(desk => {
  const holder = desk.reservedForPartnerId
  return holder == null || holder === partnerId || !partners.some(p => p.id === holder)
})

const DeskSelect = ({ desks, value, onChange, t, disabled }) => (
  <select
    className="form-field partner-desk-select"
    aria-label={t('adminPartners.desk')}
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    required
  >
    <option value="" disabled>{t('adminPartners.chooseDesk')}</option>
    {desks.map(desk => <option key={desk.id} value={desk.id}>{desk.name}</option>)}
  </select>
)

const DeskChanger = ({ partner, desks, t, onSave, onCancel, saving }) => {
  const [deskId, setDeskId] = useState(partner.deskAmenityId || '')
  return (
    <div className="partner-row-change">
      <DeskSelect desks={desks} value={deskId} onChange={setDeskId} t={t} disabled={saving} />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => onSave(partner, deskId)}
        disabled={!deskId || deskId === partner.deskAmenityId || saving}
      >
        {saving ? t('common.saving') : t('adminPartners.saveDesk')}
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={saving}>
        {t('common.cancel')}
      </button>
    </div>
  )
}

const PartnerRow = ({ partner, deskName, memberCount, t, actions, changer }) => (
  <li className="partner-row">
    <div className="partner-row-info">
      <span className="partner-row-name">{partner.name}</span>
      <span className="partner-row-meta">
        {deskName}
        {' · '}
        {t('adminPartners.memberCount', { count: memberCount })}
      </span>
    </div>
    {changer || (
      <div className="partner-row-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => actions.onChangeDesk(partner)}>
          {t('adminPartners.changeDesk')}
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => actions.onRemove(partner, memberCount)}
          disabled={actions.removing}
        >
          {t('adminPartners.remove')}
        </button>
      </div>
    )}
  </li>
)

const AddPartnerForm = ({ desks, t, onAdd, pending }) => {
  const [name, setName] = useState('')
  const [deskId, setDeskId] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (!name.trim() || !deskId || pending) return
    onAdd({ name, deskAmenityId: deskId }, () => { setName(''); setDeskId('') })
  }
  return (
    <form className="partners-add-form" onSubmit={submit}>
      <input
        type="text"
        className="form-field"
        placeholder={t('adminPartners.namePlaceholder')}
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <DeskSelect desks={desks} value={deskId} onChange={setDeskId} t={t} disabled={pending} />
      <button type="submit" className="btn btn-primary" disabled={!name.trim() || !deskId || pending}>
        {pending ? t('common.saving') : t('adminPartners.add')}
      </button>
    </form>
  )
}

const deskErrorToast = (error, t) => {
  if (error?.message === PARTNER_DESK_TAKEN) return t('toast.partnerDeskTaken')
  return null
}

const usePartnerMutations = (t, onDeskSaved) => {
  const invalidate = useInvalidateQueries()
  // A desk taken by another partner means the cached list was stale.
  const onDeskError = (fallbackKey) => (error) => {
    const taken = deskErrorToast(error, t)
    if (taken) invalidate('partners', 'amenities')
    showToast(taken || t(fallbackKey), 'error')
  }
  return {
    create: useMutation({
      mutationFn: ({ data }) => createPartner(data),
      onSuccess: (_, { onDone }) => {
        invalidate('partners', 'amenities')
        onDone()
      },
      onError: onDeskError('toast.partnerAddFailed')
    }),
    desk: useMutation({
      mutationFn: ({ id, deskAmenityId }) => setPartnerDesk(id, deskAmenityId),
      onSuccess: () => {
        invalidate('partners', 'amenities')
        onDeskSaved()
      },
      onError: onDeskError('toast.partnerDeskFailed')
    }),
    remove: useMutation({
      mutationFn: deletePartner,
      onSuccess: () => invalidate('partners', 'amenities', 'members'),
      onError: () => showToast(t('toast.partnerRemoveFailed'), 'error')
    })
  }
}

const PartnersPanel = ({ partners, members, t }) => {
  const [changingId, setChangingId] = useState(null)
  const mutations = usePartnerMutations(t, () => setChangingId(null))

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities,
    refetchOnWindowFocus: false,
    retry: 1
  })
  const desks = amenities.filter(a => a.type === 'desk')
  const deskNames = Object.fromEntries(desks.map(d => [d.id, d.name]))
  const memberCount = (partnerId) => members.filter(m => m.partnerId === partnerId).length

  const handleAdd = (data, onDone) => {
    // Duplicates would split members across two orgs ("9AM Games" / "9am games").
    if (partners.some(p => normalizePartnerName(p.name) === normalizePartnerName(data.name))) {
      showToast(t('toast.partnerDuplicate'), 'error')
      return
    }
    mutations.create.mutate({ data, onDone })
  }

  const handleSaveDesk = (partner, deskAmenityId) => {
    const confirmText = t('adminPartners.confirmChangeDesk', {
      name: partner.name, count: memberCount(partner.id), desk: deskNames[deskAmenityId]
    })
    if (window.confirm(confirmText)) mutations.desk.mutate({ id: partner.id, deskAmenityId })
  }

  const actions = {
    onChangeDesk: (partner) => setChangingId(partner.id),
    onRemove: (partner, count) => {
      if (isPendingFor(mutations.remove, partner.id)) return
      const key = count > 0 ? 'adminPartners.confirmRemoveMembers' : 'adminPartners.confirmRemove'
      if (window.confirm(t(key, { name: partner.name, count }))) mutations.remove.mutate(partner.id)
    }
  }

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
              deskName={deskNames[partner.deskAmenityId] || t(partner.deskAmenityId ? 'adminPartners.unknownDesk' : 'adminPartners.noDesk')}
              memberCount={memberCount(partner.id)}
              t={t}
              actions={{ ...actions, removing: isPendingFor(mutations.remove, partner.id) }}
              changer={changingId === partner.id && (
                <DeskChanger
                  partner={partner}
                  desks={desksOpenTo(desks, partners, partner.id)}
                  t={t}
                  onSave={handleSaveDesk}
                  onCancel={() => setChangingId(null)}
                  saving={isPendingFor(mutations.desk, partner.id)}
                />
              )}
            />
          ))}
        </ul>
      )}
      <AddPartnerForm desks={desksOpenTo(desks, partners)} t={t} onAdd={handleAdd} pending={mutations.create.isPending} />
    </section>
  )
}

export default PartnersPanel
