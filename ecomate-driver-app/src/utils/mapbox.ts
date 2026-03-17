import Mapbox from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';

// Initialize Mapbox
Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

export default Mapbox;