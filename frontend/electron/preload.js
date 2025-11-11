import { contextBridge } from 'electron';

const port = process.env.BACKEND_PORT || '8000';
const backendUrl = `http://127.0.0.1:${port}`;

contextBridge.exposeInMainWorld('api', {
  backendUrl
});
