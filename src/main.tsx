import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import PetDemo from './components/PetCompanion/PetDemo.tsx';
import './index.css';

// Регистрируем сервис-воркер: приложение работает офлайн и обновляется само.
registerSW({immediate: true});

// Отладочный стенд питомца: только в dev и только по явному ?pet-demo.
// В продакшен-сборку не попадает — условие вычисляется на этапе сборки.
const showPetDemo =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('pet-demo');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{showPetDemo ? <PetDemo /> : <App />}</StrictMode>,
);
