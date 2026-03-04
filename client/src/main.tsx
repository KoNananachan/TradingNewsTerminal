import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Web3Provider } from './components/providers/web3-provider';
import { ErrorBoundary } from './components/common/error-boundary';
import App from './App';
import './index.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function AppWithProviders() {
  const core = (
    <Web3Provider>
      <App />
    </Web3Provider>
  );

  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      {core}
    </GoogleOAuthProvider>
  ) : (
    core
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppWithProviders />
    </ErrorBoundary>
  </StrictMode>,
);
