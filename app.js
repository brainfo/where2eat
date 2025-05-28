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
        // First, get the coordinates for the city
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${this.apiKey}`;
        
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();
        
        if (geocodeData.status !== 'OK' || geocodeData.results.length === 0) {
            throw new Error('City not found');
        }

        const location = geocodeData.results[0].geometry.location;
        
        // Search for restaurants near this location
        const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=10000&type=restaurant&key=${this.apiKey}`;
        
        const placesResponse = await fetch(placesUrl);
        const placesData = await placesResponse.json();
        
        if (placesData.status !== 'OK') {
            throw new Error('Places search failed');
        }

        // Filter restaurants by rating and remove those without ratings
        const filteredRestaurants = placesData.results.filter(restaurant => {
            const rating = restaurant.rating || 0;
            return rating >= minRating && restaurant.business_status === 'OPERATIONAL';
        });

        return filteredRestaurants;
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