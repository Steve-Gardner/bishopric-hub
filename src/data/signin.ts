// People sign in with an emailed code and then stay signed in on that phone. The app asks for a new code every
// SIGN_IN_DAYS, counted from the last code entered on that device. (Supabase can enforce this itself, but only on
// its paid plan, so the app does it.)
export const SIGN_IN_DAYS = 60
const KEY = 'bishopric.signedInAt'

export const noteSignedIn = () => {
  try { localStorage.setItem(KEY, String(Date.now())) } catch { /* private mode */ }
}

// True when the code was entered too long ago. A phone that was signed in before this existed gets today as its
// starting point, so nobody is signed out the moment this ships.
export function mustSignInAgain(): boolean {
  try {
    const saved = Number(localStorage.getItem(KEY))
    if (!saved) { noteSignedIn(); return false }
    return Date.now() - saved > SIGN_IN_DAYS * 24 * 60 * 60 * 1000
  } catch { return false }
}
