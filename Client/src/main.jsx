import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { store } from './app/store';
import { setCredentials, setLoading } from './features/auth/authSlice';
import { refreshSession } from './features/auth/authAPI';
import router from './routes/AppRoutes';
import './index.css';

async function bootstrap() {
  store.dispatch(setLoading(true));

  try {
    const response = await refreshSession();
    if (response?.accessToken && response?.user) {
      store.dispatch(setCredentials({
        user: response.user,
        accessToken: response.accessToken,
      }));
    }
  } catch (error) {
  } finally {
    store.dispatch(setLoading(false));
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </React.StrictMode>
  );
}

bootstrap();
