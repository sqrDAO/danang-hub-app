import { httpsCallable } from 'firebase/functions'
import { signInWithCustomToken } from 'firebase/auth'
import { auth, functions } from './firebase'

const generateWalletNonce = httpsCallable(functions, 'generateWalletNonce')
const verifyWalletSignature = httpsCallable(functions, 'verifyWalletSignature')

export function formatAddress(addr) {
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

/**
 * Discovers all installed EVM wallets using EIP-6963.
 * Returns an array of { info: { name, icon, uuid, rdns }, provider } objects.
 */
export function discoverEIP6963Wallets() {
  return new Promise((resolve) => {
    const wallets = []
    const handler = (event) => wallets.push(event.detail)
    window.addEventListener('eip6963:announceProvider', handler)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', handler)
      resolve(wallets)
    }, 100)
  })
}

/**
 * Signs in with an EVM wallet using the given EIP-6963 provider and address.
 */
export async function signInWithEVMWallet(provider, address) {
  const { data } = await generateWalletNonce({ address, chain: 'ethereum' })
  const message = `Sign in to Da Nang Blockchain Hub\nNonce: ${data.nonce}`

  const signature = await provider.request({
    method: 'personal_sign',
    params: [message, address],
  })

  const { data: verifyData } = await verifyWalletSignature({ address, signature, chain: 'ethereum' })
  const credential = await signInWithCustomToken(auth, verifyData.token)
  return credential.user
}

/**
 * Discovers all installed Solana wallets using the Wallet Standard,
 * with a fallback to the legacy window.solana provider.
 * Returns an array of { name, icon, _wallet?, _legacy?, _provider? } objects.
 */
export function discoverSolanaWallets() {
  return new Promise((resolve) => {
    const wallets = []

    const register = (wallet) => {
      if (
        wallet?.chains?.some((c) => c.startsWith('solana:')) &&
        wallet?.features?.['standard:connect'] &&
        wallet?.features?.['solana:signMessage']
      ) {
        wallets.push({ name: wallet.name, icon: wallet.icon, _wallet: wallet })
      }
    }

    const handleRegister = (event) => register(event.detail)
    window.addEventListener('wallet-standard:register-wallet', handleRegister)
    window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: { register } }))

    setTimeout(() => {
      window.removeEventListener('wallet-standard:register-wallet', handleRegister)

      // Fallback for legacy window.solana (older Phantom versions, etc.)
      if (wallets.length === 0 && window.solana) {
        wallets.push({
          name: window.solana.isPhantom ? 'Phantom' : 'Solana Wallet',
          icon: null,
          _legacy: true,
          _provider: window.solana,
        })
      }

      resolve(wallets)
    }, 100)
  })
}

/**
 * Signs in with a discovered Solana wallet entry.
 * Supports both Wallet Standard and legacy window.solana providers.
 * Returns { user, address }.
 */
export async function signInWithSolanaWallet(walletEntry) {
  let address, signatureHex

  if (walletEntry._legacy) {
    await walletEntry._provider.connect()
    address = walletEntry._provider.publicKey.toString()

    const { data } = await generateWalletNonce({ address, chain: 'solana' })
    const message = `Sign in to Da Nang Blockchain Hub\nNonce: ${data.nonce}`
    const messageBytes = new TextEncoder().encode(message)
    const { signature } = await walletEntry._provider.signMessage(messageBytes, 'utf8')
    signatureHex = Array.from(signature).map((b) => b.toString(16).padStart(2, '0')).join('')
  } else {
    const wallet = walletEntry._wallet
    const { accounts } = await wallet.features['standard:connect'].connect()
    const account = accounts[0]
    address = account.address

    const { data } = await generateWalletNonce({ address, chain: 'solana' })
    const message = `Sign in to Da Nang Blockchain Hub\nNonce: ${data.nonce}`
    const messageBytes = new TextEncoder().encode(message)
    const [{ signature }] = await wallet.features['solana:signMessage'].signMessage({
      account,
      message: messageBytes,
    })
    signatureHex = Array.from(signature).map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  const { data: verifyData } = await verifyWalletSignature({ address, signature: signatureHex, chain: 'solana' })
  const credential = await signInWithCustomToken(auth, verifyData.token)
  return { user: credential.user, address }
}
