import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { consumePostAuthPath } from '../lib/authRedirect'

interface SignInPanelProps {
  onSuccess?: () => void
  compact?: boolean
  redirectTo?: string
  lead?: string
}

export function SignInPanel({
  onSuccess,
  compact = false,
  redirectTo = '/my',
  lead,
}: SignInPanelProps) {
  const navigate = useNavigate()
  const { signInWithEmail, verifyEmailOtp, signInWithGoogle, authAvailable } = useAuth()
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (!authAvailable) {
    return (
      <p className="auth-hint">
        Sign-in requires Supabase. Connect your project to sync Studio and save memorials.
      </p>
    )
  }

  const sendMagicLink = async () => {
    const trimmed = email.trim()
    if (!trimmed) return
    setStatus('sending')
    setMessage(null)
    const { error } = await signInWithEmail(trimmed, redirectTo)
    if (error) {
      setStatus('error')
      setMessage(error)
      return
    }
    setStatus('sent')
    setMessage(null)
    onSuccess?.()
  }

  const verifyCode = async () => {
    const trimmedEmail = email.trim()
    const trimmedCode = otpCode.trim()
    if (!trimmedEmail || !trimmedCode) return
    setStatus('verifying')
    setMessage(null)
    const { error } = await verifyEmailOtp(trimmedEmail, trimmedCode)
    if (error) {
      setStatus('sent')
      setMessage(error)
      return
    }
    const next = consumePostAuthPath() ?? redirectTo
    navigate(next, { replace: true })
  }

  const signInGoogle = async () => {
    setStatus('sending')
    setMessage(null)
    const { error } = await signInWithGoogle(redirectTo)
    if (error) {
      setStatus('error')
      setMessage(error)
    }
  }

  return (
    <div className={`sign-in-panel${compact ? ' compact' : ''}`}>
      <p className="sign-in-lead">
        {lead ??
          (compact
            ? 'Sign in to save memorials to your account and recover links anytime.'
            : 'We’ll email you a magic link — no password needed.')}
      </p>

      {status === 'sent' || status === 'verifying' ? (
        <div className="sign-in-sent">
          <span className="sign-in-sent-icon">✉️</span>
          <p>Check your email for a sign-in link or 6-digit code.</p>
          <p className="auth-hint sign-in-gmail-tip">
            <strong>Gmail tip:</strong> tap the link’s menu (⋯) and choose{' '}
            <strong>Open in Safari</strong> or <strong>Chrome</strong> — not Gmail’s in-app
            browser. Gmail may prefetch links and break magic links; the code below always works.
          </p>

          <label className="sign-in-email-label">
            6-digit code from email
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
              disabled={status === 'verifying'}
            />
          </label>
          <button
            type="button"
            className="btn-call"
            disabled={otpCode.trim().length < 6 || status === 'verifying'}
            onClick={verifyCode}
          >
            {status === 'verifying' ? 'Verifying…' : 'Sign in with code'}
          </button>

          <button
            type="button"
            className="btn-text"
            onClick={() => {
              setStatus('idle')
              setOtpCode('')
              setMessage(null)
            }}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <label className="sign-in-email-label">
            Email
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMagicLink()}
              disabled={status === 'sending'}
            />
          </label>
          <button
            type="button"
            className="btn-call"
            disabled={!email.trim() || status === 'sending'}
            onClick={sendMagicLink}
          >
            {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
          <div className="sign-in-divider">
            <span>or</span>
          </div>
          <button
            type="button"
            className="btn-secondary sign-in-google"
            disabled={status === 'sending'}
            onClick={signInGoogle}
          >
            Continue with Google
          </button>
        </>
      )}

      {status === 'error' && message && <p className="form-error">{message}</p>}
      {status === 'sent' && message && <p className="form-error">{message}</p>}
    </div>
  )
}
