

import { createRoot } from "react-dom/client";  
import App from "./app/App.tsx";  
import "./styles/index.css";  
import posthog from 'posthog-js';  
import { PostHogProvider } from '@posthog/react';

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {  
  api_host: import.meta.env.VITE_POSTHOG_HOST,  
  defaults: '2026-01-30',  
});

createRoot(document.getElementById("root")!).render(  
  <PostHogProvider client={posthog}>  
    <App />  
  </PostHogProvider>  
);  
