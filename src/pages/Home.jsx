import { MapaSucursales } from '../components/MapaSucursales';
import { ArrowRight, Clock3, MapPin, ShieldCheck } from 'lucide-react';
import './Home.css';

const featuredVehicles = [
    { number: 1, name: 'Compactos', detail: 'Fáciles de manejar' },
    { number: 2, name: 'SUV', detail: 'Más espacio y confort' },
    { number: 3, name: 'Deportivos', detail: 'Diseñados para destacar' },
    { number: 4, name: 'Camionetas', detail: 'Potencia para cada ruta' }
].map((vehicle) => ({
    ...vehicle,
    src: `/fotos/${vehicle.number}.jpg`,
    alt: `Vehículo destacado de categoría ${vehicle.name}`
}));

const benefits = [
    {
        icon: ShieldCheck,
        title: 'Seguridad incluida',
        text: 'Opciones de cobertura claras y atención durante todo el alquiler.'
    },
    {
        icon: MapPin,
        title: 'Sucursales estratégicas',
        text: 'Recoge tu vehículo en la oficina central o en el aeropuerto.'
    },
    {
        icon: Clock3,
        title: 'Proceso ágil',
        text: 'Solicita en línea y recibe confirmación por WhatsApp.'
    }
];

export function Home({ onTabChange }) {
    return (
        <div className="home-page">
            <section className="home-hero">
                <video
                    className="home-hero-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster="/fotos/KIA2.jpg"
                    aria-hidden="true"
                >
                    <source src="/kia.mp4" type="video/mp4" />
                </video>
                <div className="home-hero-overlay" />
                <div className="home-hero-content">
                    <span className="home-hero-eyebrow">Santa Lucía Alquiler</span>
                    <h1>Tu próximo viaje comienza aquí</h1>
                    <p>Elige el vehículo ideal para cada destino, con reservas sencillas y atención personalizada.</p>
                    <div className="home-hero-actions">
                        <button type="button" onClick={() => onTabChange('fleet')}>
                            Ver nuestra flota
                            <ArrowRight size={18} aria-hidden="true" />
                        </button>
                        <button
                            className="home-hero-secondary"
                            type="button"
                            onClick={() => onTabChange('location')}
                        >
                            <MapPin size={18} aria-hidden="true" />
                            Encuentra una sucursal
                        </button>
                    </div>
                </div>
            </section>

            <section className="home-benefits" aria-label="Beneficios del servicio">
                {benefits.map(({ icon: Icon, title, text }) => (
                    <article className="home-benefit" key={title}>
                        <span className="home-benefit-icon">
                            <Icon size={22} aria-hidden="true" />
                        </span>
                        <div>
                            <h2>{title}</h2>
                            <p>{text}</p>
                        </div>
                    </article>
                ))}
            </section>

            <section className="home-vehicles" aria-labelledby="home-vehicles-title">
                <div className="home-section-heading">
                    <span>Nuestra selección</span>
                    <h2 id="home-vehicles-title">Encuentra tu próximo vehículo</h2>
                    <p>Una flota preparada para viajes diarios, familiares y de trabajo.</p>
                </div>
                <div className="home-vehicles-grid">
                    {featuredVehicles.map((vehicle) => (
                        <button
                            className="home-vehicle-card"
                            key={vehicle.src}
                            type="button"
                            onClick={() => onTabChange('fleet')}
                            aria-label={`${vehicle.name}. ${vehicle.detail}. Ver nuestra flota`}
                        >
                            <img src={vehicle.src} alt={vehicle.alt} />
                            <span className="home-vehicle-card-copy">
                                <strong>{vehicle.name}</strong>
                                <small>{vehicle.detail}</small>
                            </span>
                        </button>
                    ))}
                </div>
                <button
                    className="home-fleet-link"
                    type="button"
                    onClick={() => onTabChange('fleet')}
                >
                    Explorar todos los autos
                </button>
            </section>

            <section className="home-location" aria-labelledby="home-location-title">
                <div className="home-section-heading">
                    <span>Nuestra ubicación</span>
                    <h2 id="home-location-title">Dónde encontrarnos</h2>
                    <p>Encuentra nuestra sucursal y calcula la distancia desde tu dirección.</p>
                </div>
                <MapaSucursales />
            </section>
        </div>
    );
}
