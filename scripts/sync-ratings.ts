import { refreshImdbRatings, imdbRating } from '../server/ratings.ts'
await refreshImdbRatings()
console.log('IMDb snapshot ready:', await imdbRating('tt0816692'))
