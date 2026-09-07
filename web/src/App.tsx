import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AuthRedirectHandler } from './components/AuthRedirectHandler'
import { CatalogView } from './components/CatalogView'
import { CreateMemorialView } from './components/CreateMemorialView'
import { EditMemorialView } from './components/EditMemorialView'
import { LandingView } from './components/LandingView'
import { MyMemorialsView } from './components/MyMemorialsView'
import { ShareMemorialView } from './components/ShareMemorialView'

function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <AuthRedirectHandler />
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/catalog" element={<CatalogView />} />
          <Route path="/create" element={<CreateMemorialView />} />
          <Route path="/my" element={<MyMemorialsView />} />
          <Route path="/m/:shareId" element={<ShareMemorialView />} />
          <Route path="/edit/:editToken" element={<EditMemorialView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
