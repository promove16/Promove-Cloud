import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export const getRootState = () => store.getState();
export const getAppDispatch = () => store.dispatch;
