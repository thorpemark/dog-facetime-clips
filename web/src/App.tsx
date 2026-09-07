import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AuthRedirectHandler } from './components/AuthRedirectHandler'
import { CatalogView } from './components/CatalogView'
import { CreateMemorialView } from './components/CreateMemorialView'
import { DemoCallView } from './components/DemoCallView'
import { EditMemorialView } from './components/EditMemorialView'
import { LandingView } from './components/LandingView'
import { MyMemorialsView } from './components/MyMemorialsView'
import { ShareMemorialView } from './components/ShareMemorialView'
import { StudioView } from './components/StudioView'

function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <AuthRedirectHandler />
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/studio" element={<StudioView />} />
          <Route path="/catalog" element={<CatalogView />} />
          <Route path="/demo" element={<DemoCallView />} />
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
