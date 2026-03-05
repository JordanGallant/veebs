import { navigate, registerScreen } from '../lib/router.js';

export function registerBirthing() {
  registerScreen('birthing', {
    render() { navigate('dashboard'); },
  });
}
