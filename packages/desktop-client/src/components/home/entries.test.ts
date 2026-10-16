import { transferPurpose } from './entries';

describe('transferPurpose', () => {
  it('reads the purpose after the bank reference', () => {
    expect(
      transferPurpose('1046102862730 PAYPAL | Pour : Uber Eats du 11/10/2026'),
    ).toBe('Uber Eats du 11/10/2026');
  });

  it('reads a purpose written alone', () => {
    expect(transferPurpose('Pour : approvisionnement du solde PayPal')).toBe(
      'approvisionnement du solde PayPal',
    );
  });

  it('returns null without a purpose', () => {
    expect(transferPurpose('1031791306051 PAYPAL')).toBeNull();
    expect(transferPurpose(null)).toBeNull();
  });
});
