import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom'
import { createRoot } from 'react-dom/client'
import 'material-symbols/outlined.css'
import 'material-symbols/rounded.css'
import './index.css'
import App from './App.tsx'
import { useAppStore } from './store/useAppStore'

window.React = React;
window.ReactDOM = ReactDOM;
window.useAppStore = useAppStore;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)