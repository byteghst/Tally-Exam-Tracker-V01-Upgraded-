export interface BdCity {
  name: string;
  lat: number;
  lng: number;
}

/**
 * The 64 districts of Bangladesh, with approximate coordinates (a couple of
 * decimals is plenty: prayer times shift by well under a minute for that).
 */
export const BD_CITIES: BdCity[] = [
  { name: 'Bagerhat', lat: 22.65, lng: 89.79 },
  { name: 'Bandarban', lat: 22.2, lng: 92.22 },
  { name: 'Barguna', lat: 22.15, lng: 90.13 },
  { name: 'Barishal', lat: 22.7, lng: 90.37 },
  { name: 'Bhola', lat: 22.69, lng: 90.65 },
  { name: 'Bogura', lat: 24.85, lng: 89.37 },
  { name: 'Brahmanbaria', lat: 23.96, lng: 91.11 },
  { name: 'Chandpur', lat: 23.23, lng: 90.67 },
  { name: 'Chapainawabganj', lat: 24.6, lng: 88.28 },
  { name: 'Chattogram', lat: 22.36, lng: 91.78 },
  { name: 'Chuadanga', lat: 23.64, lng: 88.85 },
  { name: "Cox's Bazar", lat: 21.43, lng: 91.98 },
  { name: 'Cumilla', lat: 23.46, lng: 91.18 },
  { name: 'Dhaka', lat: 23.81, lng: 90.41 },
  { name: 'Dinajpur', lat: 25.63, lng: 88.64 },
  { name: 'Faridpur', lat: 23.6, lng: 89.84 },
  { name: 'Feni', lat: 23.02, lng: 91.4 },
  { name: 'Gaibandha', lat: 25.33, lng: 89.53 },
  { name: 'Gazipur', lat: 24.0, lng: 90.42 },
  { name: 'Gopalganj', lat: 23.01, lng: 89.83 },
  { name: 'Habiganj', lat: 24.38, lng: 91.42 },
  { name: 'Jamalpur', lat: 24.92, lng: 89.94 },
  { name: 'Jashore', lat: 23.17, lng: 89.21 },
  { name: 'Jhalokati', lat: 22.64, lng: 90.2 },
  { name: 'Jhenaidah', lat: 23.54, lng: 89.17 },
  { name: 'Joypurhat', lat: 25.1, lng: 89.02 },
  { name: 'Khagrachhari', lat: 23.12, lng: 91.98 },
  { name: 'Khulna', lat: 22.82, lng: 89.55 },
  { name: 'Kishoreganj', lat: 24.43, lng: 90.78 },
  { name: 'Kurigram', lat: 25.81, lng: 89.64 },
  { name: 'Kushtia', lat: 23.9, lng: 89.12 },
  { name: 'Lakshmipur', lat: 22.94, lng: 90.84 },
  { name: 'Lalmonirhat', lat: 25.99, lng: 89.45 },
  { name: 'Madaripur', lat: 23.17, lng: 90.2 },
  { name: 'Magura', lat: 23.49, lng: 89.42 },
  { name: 'Manikganj', lat: 23.86, lng: 90.0 },
  { name: 'Meherpur', lat: 23.76, lng: 88.63 },
  { name: 'Moulvibazar', lat: 24.48, lng: 91.77 },
  { name: 'Munshiganj', lat: 23.55, lng: 90.53 },
  { name: 'Mymensingh', lat: 24.75, lng: 90.41 },
  { name: 'Naogaon', lat: 24.8, lng: 88.94 },
  { name: 'Narail', lat: 23.17, lng: 89.5 },
  { name: 'Narayanganj', lat: 23.63, lng: 90.5 },
  { name: 'Narsingdi', lat: 23.92, lng: 90.72 },
  { name: 'Natore', lat: 24.41, lng: 89.0 },
  { name: 'Netrokona', lat: 24.87, lng: 90.73 },
  { name: 'Nilphamari', lat: 25.93, lng: 88.86 },
  { name: 'Noakhali', lat: 22.87, lng: 91.1 },
  { name: 'Pabna', lat: 24.0, lng: 89.23 },
  { name: 'Panchagarh', lat: 26.34, lng: 88.55 },
  { name: 'Patuakhali', lat: 22.36, lng: 90.33 },
  { name: 'Pirojpur', lat: 22.58, lng: 89.97 },
  { name: 'Rajbari', lat: 23.76, lng: 89.64 },
  { name: 'Rajshahi', lat: 24.37, lng: 88.6 },
  { name: 'Rangamati', lat: 22.65, lng: 92.17 },
  { name: 'Rangpur', lat: 25.75, lng: 89.25 },
  { name: 'Satkhira', lat: 22.72, lng: 89.07 },
  { name: 'Shariatpur', lat: 23.24, lng: 90.43 },
  { name: 'Sherpur', lat: 25.02, lng: 90.02 },
  { name: 'Sirajganj', lat: 24.45, lng: 89.7 },
  { name: 'Sunamganj', lat: 25.07, lng: 91.4 },
  { name: 'Sylhet', lat: 24.9, lng: 91.87 },
  { name: 'Tangail', lat: 24.25, lng: 89.92 },
  { name: 'Thakurgaon', lat: 26.03, lng: 88.46 }
];

export const DEFAULT_CITY = 'Dhaka';

export function findCity(name: string): BdCity {
  return BD_CITIES.find((c) => c.name === name) ?? (BD_CITIES.find((c) => c.name === DEFAULT_CITY) as BdCity);
}
