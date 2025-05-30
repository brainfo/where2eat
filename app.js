class Where2Eat {
    constructor() {
        this.apiKey = localStorage.getItem('googleMapsApiKey') || '';
        this.currentRestaurants = [];
        this.currentCity = '';
        this.currentRating = 0;
        
        this.initializeEventListeners();
        this.loadSavedApiKey();
    }

    initializeEventListeners() {
        document.getElementById('saveApiKey').addEventListener('click', () => this.saveApiKey());
        document.getElementById('findRestaurant').addEventListener('click', () => this.findRandomRestaurant());
        document.getElementById('findAnother').addEventListener('click', () => this.findRandomRestaurant());
        document.getElementById('getDirections').addEventListener('click', () => this.getDirections());
        
        // Allow Enter key to trigger search
        document.getElementById('city').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.findRandomRestaurant();
        });
        
        document.getElementById('apiKey').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveApiKey();
        });
    }

    loadSavedApiKey() {
        if (this.apiKey) {
            document.getElementById('apiKey').value = this.apiKey;
        }
    }

    saveApiKey() {
        const apiKeyInput = document.getElementById('apiKey');
        this.apiKey = apiKeyInput.value.trim();
        
        if (this.apiKey) {
            localStorage.setItem('googleMapsApiKey', this.apiKey);
            this.showMessage('API key saved successfully!', 'success');
        } else {
            this.showError('Please enter a valid API key');
        }
    }

    async findRandomRestaurant() {
        if (!this.validateInputs()) return;

        const city = document.getElementById('city').value.trim();
        const rating = parseFloat(document.getElementById('rating').value);

        // If same search parameters, pick from existing results
        if (city === this.currentCity && rating === this.currentRating && this.currentRestaurants.length > 0) {
            this.displayRandomRestaurant();
            return;
        }

        this.showLoading();
        
        try {
            const restaurants = await this.searchRestaurants(city, rating);
            
            if (restaurants.length === 0) {
                this.showError('No restaurants found matching your criteria. Try a different city or lower rating threshold.');
                return;
            }

            this.currentRestaurants = restaurants;
            this.currentCity = city;
            this.currentRating = rating;
            
            this.displayRandomRestaurant();
            
        } catch (error) {
            console.error('Error finding restaurants:', error);
            this.showError('Failed to find restaurants. Please check your API key and try again.');
        }
    }

    validateInputs() {
        if (!this.apiKey) {
            this.showError('Please enter and save your Google Maps API key first');
            return false;
        }

        const city = document.getElementById('city').value.trim();
        if (!city) {
            this.showError('Please enter a city name');
            return false;
        }

        return true;
    }

    async searchRestaurants(city, minRating) {
        try {
            // Use Geocoding REST API instead of JavaScript API
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${this.apiKey}`;
            
            const geocodeResponse = await fetch(geocodeUrl);
            const geocodeData = await geocodeResponse.json();
            
            if (geocodeData.status !== 'OK' || !geocodeData.results.length) {
                throw new Error(`City not found: ${geocodeData.status}`);
            }
            
            const location = geocodeData.results[0].geometry.location;
            
            // Use the new Nearby Search API (New)
            const searchRequest = {
                includedTypes: [
                    'restaurant', 'meal_takeaway', 'meal_delivery',
                    'cafe', 'bar', 'bakery', 
                    'sandwich_shop', 'ice_cream_shop', 'coffee_shop'
                ],
                excludedTypes: ['lodging'],
                locationRestriction: {
                    circle: {
                        center: {
                            latitude: location.lat,
                            longitude: location.lng
                        },
                        radius: 10000.0
                    }
                },
                maxResultCount: 20
            };
            
            const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.types,places.businessStatus,places.id'
                },
                body: JSON.stringify(searchRequest)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Places API error: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            const data = await response.json();
            
            if (!data.places) {
                return [];
            }
            
            // Filter by rating and transform to match legacy format
            const filteredRestaurants = data.places
                .filter(place => {
                    const rating = place.rating || 0;
                    return rating >= minRating && 
                           place.businessStatus === 'OPERATIONAL' &&
                           place.displayName;
                })
                .map(place => ({
                    name: place.displayName?.text || 'Unknown',
                    rating: place.rating,
                    user_ratings_total: place.userRatingCount,
                    vicinity: place.formattedAddress,
                    types: place.types,
                    business_status: place.businessStatus,
                    place_id: place.id
                }));
            
            return filteredRestaurants;
            
        } catch (error) {
            console.error('Search error:', error);
            throw error;
        }
    }

    displayRandomRestaurant() {
        if (this.currentRestaurants.length === 0) {
            this.showError('No restaurants available');
            return;
        }

        const randomIndex = Math.floor(Math.random() * this.currentRestaurants.length);
        const restaurant = this.currentRestaurants[randomIndex];

        document.getElementById('restaurantName').textContent = restaurant.name;
        document.getElementById('restaurantRating').textContent = `⭐ ${restaurant.rating || 'No rating'} (${restaurant.user_ratings_total || 0} reviews)`;
        document.getElementById('restaurantAddress').textContent = `📍 ${restaurant.vicinity}`;
        document.getElementById('restaurantType').textContent = `🍽️ ${restaurant.types ? restaurant.types.join(', ').replace(/_/g, ' ') : 'Restaurant'}`;

        // Store current restaurant for directions
        this.currentSelectedRestaurant = restaurant;

        this.hideLoading();
        this.hideError();
        this.showResult();
    }

    getDirections() {
        if (this.currentSelectedRestaurant) {
            const restaurantName = encodeURIComponent(this.currentSelectedRestaurant.name);
            const placeId = this.currentSelectedRestaurant.place_id;
            
            // Open Google Maps with directions
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${restaurantName}&destination_place_id=${placeId}`;
            window.open(mapsUrl, '_blank');
        }
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('result').classList.add('hidden');
        document.getElementById('error').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showResult() {
        document.getElementById('result').classList.remove('hidden');
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('error').classList.remove('hidden');
        document.getElementById('result').classList.add('hidden');
        this.hideLoading();
    }

    hideError() {
        document.getElementById('error').classList.add('hidden');
    }

    showMessage(message, type = 'info') {
        // Simple message display - you could enhance this with a toast system
        alert(message);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new Where2Eat();
});