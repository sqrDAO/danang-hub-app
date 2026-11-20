const IMPORT_ERROR_KEYS = {
  'functions/invalid-argument': 'toast.eventImportUnsupported',
  'functions/resource-exhausted': 'toast.eventImportRateLimited',
  'functions/not-found': 'toast.eventImportNoData'
}

export const getEventImportErrorKey = (error) =>
  IMPORT_ERROR_KEYS[error?.code] || 'toast.eventImportFailed'
