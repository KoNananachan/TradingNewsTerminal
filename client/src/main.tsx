import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Web3Provider } from './components/providers/web3-provider';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Web3Provider>
      <App />
    </Web3Provider>
  </StrictMode>,
);
