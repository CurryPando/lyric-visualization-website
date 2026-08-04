export async function getUmapData() {
  const CACHE_NAME = 'umap-data-v1';
  const DATA_URL = 'http://localhost:8000/api/umap-cluster'; // or static host

  // Check if Cache Storage has the file
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(DATA_URL);

  if (cachedResponse) {
    return await cachedResponse.json();
  }

  //If not in cache, fetch from server and store in cache
  console.log("First visit: Fetching UMAP points from API...");
  const networkResponse = await fetch(DATA_URL);
  
  cache.put(DATA_URL, networkResponse.clone());
  
  return await networkResponse.json();
}