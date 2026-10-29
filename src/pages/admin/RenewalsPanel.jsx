import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Modal from '../../components/Modal'
import { useInvalidateQueries } from '../../hooks/useInvalidateQueries'
import { approveFixedDeskRenewal, rejectFixedDeskRenewal } from '../../services/bookings'
import { checkBookingConflictsStrict } from '../../services/functions'
import { isPendingRenewal } from '../../utils/renewals'
import { formatDateDDMMYYYY } from '../../utils/timezone'
import { showToast } from '../../utils/toast'

// Fixed Desk renewals waiting for an admin, one row per plan. Their days hold
// no seat while they wait, so approving re-checks every day and drops the
// ones whose seat has gone (approveFixedDeskRenewal).
const groupRenewals = (bookings) => {
  const groups = new Map()
  bookings.filter(isPendingRenewal).forEach(b => {
    groups.set(b.planGroupId, [...(groups.get(b.planGroupId) || []), b])
  })
  return [...groups.entries()].map(([planGroupId, days]) => {
    const sorted = [...days].sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    return {
      planGroupId,
      memberId: sorted[0].memberId,
      amenityId: sorted[0].amenityId,
      planPeriod: sorted[0].planPeriod,
      startDate: sorted[0].startTime,
      endDate: sorted[sorted.length - 1].endTime,
      count: sorted.length,
    }
  }).sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
}

const RenewalRow = ({ renewal, memberName, deskName, t, onApprove, onReject, busy }) => (
  <li className="renewal-row">
    <div className="renewal-row-info">
      <strong>{memberName}</strong>
      <span>{deskName} · {renewal.planPeriod === 'weekly' ? t('fixedDesk.weekly') : t('fixedDesk.monthly')}</span>
      <span>
        {formatDateDDMMYYYY(renewal.startDate)} – {formatDateDDMMYYYY(renewal.endDate)} · {t('fixedDesk.workingDays', { count: renewal.count })}
      </span>
    </div>
    <div className="action-buttons">
      <button className="btn btn-primary btn-sm" onClick={() => onApprove(renewal)} disabled={busy}>
        {t('adminRenewals.approve')}
      </button>
      <button className="btn btn-danger btn-sm" onClick={() => onReject(renewal)} disabled={busy}>
        {t('common.reject')}
      </button>
    </div>
  </li>
)

const RejectRenewalForm = ({ t, onSubmit, onCancel, isSubmitting }) => {
  const [reason, setReason] = useState('')
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(reason)
  }
  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">{t('adminRenewals.reasonLabel')}</label>
        <textarea
          className="form-field"
          rows={3}
          maxLength={300}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={t('adminRenewals.reasonPlaceholder')}
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-danger" disabled={isSubmitting}>
          {t('adminRenewals.confirmReject')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSubmitting}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

const useRenewalMutations = (t, onRejected) => {
  const invalidate = useInvalidateQueries()
  const approveMutation = useMutation({
    mutationFn: ({ id }) => approveFixedDeskRenewal(id, checkBookingConflictsStrict),
    onSuccess: ({ approved, dropped }) => {
      invalidate('bookings', 'memberStats')
      showToast(t('adminRenewals.approved', { approved, dropped }), dropped > 0 ? 'info' : 'success')
    },
    onError: () => {
      // Days approved before the failure stay approved; refresh to show them.
      invalidate('bookings')
      showToast(t('adminRenewals.approveFailed'), 'error')
    }
  })
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => rejectFixedDeskRenewal(id, reason),
    onSuccess: () => {
      invalidate('bookings', 'memberStats')
      showToast(t('adminRenewals.rejected'), 'success')
      onRejected()
    },
    onError: () => showToast(t('adminRenewals.rejectFailed'), 'error')
  })
  return { approveMutation, rejectMutation }
}

const busyRenewalId = ({ approveMutation, rejectMutation }) => {
  if (approveMutation.isPending) return approveMutation.variables?.id
  if (rejectMutation.isPending) return rejectMutation.variables?.id
  return null
}

const RenewalsPanel = ({ bookings, members, amenities, t }) => {
  const [rejecting, setRejecting] = useState(null)
  const mutations = useRenewalMutations(t, () => setRejecting(null))
  const renewals = groupRenewals(bookings)
  if (renewals.length === 0) return null

  const busyId = busyRenewalId(mutations)
  const memberName = (id) => members.find(m => m.id === id)?.displayName || t('common.na')
  const deskName = (id) => amenities.find(a => a.id === id)?.name || id

  return (
    <section className="renewals-panel glass">
      <h2 className="section-title">{t('adminRenewals.title', { count: renewals.length })}</h2>
      <p className="form-hint">{t('adminRenewals.description')}</p>
      <ul className="renewals-list">
        {renewals.map(renewal => (
          <RenewalRow
            key={renewal.planGroupId}
            renewal={renewal}
            memberName={memberName(renewal.memberId)}
            deskName={deskName(renewal.amenityId)}
            t={t}
            onApprove={r => mutations.approveMutation.mutate({ id: r.planGroupId })}
            onReject={setRejecting}
            busy={busyId === renewal.planGroupId}
          />
        ))}
      </ul>
      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title={t('adminRenewals.rejectTitle')}>
        <RejectRenewalForm
          t={t}
          onSubmit={reason => mutations.rejectMutation.mutate({ id: rejecting.planGroupId, reason })}
          onCancel={() => setRejecting(null)}
          isSubmitting={mutations.rejectMutation.isPending}
        />
      </Modal>
    </section>
  )
}

export default RenewalsPanel
