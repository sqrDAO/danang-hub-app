export const consumeCreateAction = ({
  searchParams, currentUser, openCreateForAmenity, handleOpenCreateModal, setSearchParams,
  isLoadingAmenities
}) => {
  if (searchParams.get('action') !== 'create' || !currentUser) return
  if (isLoadingAmenities) return
  const amenityId = searchParams.get('amenityId')
  if (amenityId) openCreateForAmenity(amenityId)
  else handleOpenCreateModal()
  const nextParams = new URLSearchParams(searchParams)
  nextParams.delete('action')
  nextParams.delete('amenityId')
  setSearchParams(nextParams, { replace: true })
}
