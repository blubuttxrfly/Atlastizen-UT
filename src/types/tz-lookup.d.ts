declare module "tz-lookup" {
  /**
   * Synchronously look up the IANA timezone name for a given latitude and longitude.
   * @param lat Latitude in decimal degrees
   * @param lon Longitude in decimal degrees
   * @returns IANA timezone name (e.g., "America/Indiana/Indianapolis")
   */
  function tzLookup(lat: number, lon: number): string;
  export default tzLookup;
}