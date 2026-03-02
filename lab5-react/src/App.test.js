import { render, screen } from '@testing-library/react';
import App from './App';

test('renders schedule heading', () => {
  render(<App />);
  const heading = screen.getByText(/розклад університету/i);
  expect(heading).toBeInTheDocument();
});
