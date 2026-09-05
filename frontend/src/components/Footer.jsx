import { Link } from 'react-router-dom';
import { Package, Mail, Phone, MapPin, Globe2 } from 'lucide-react';

const Footer = () => (
  <footer className="bg-foreground text-primary-foreground">
    <div className="container mx-auto px-4 md:px-6 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <Package className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="font-display text-xl font-bold">
              Swift<span className="text-accent">Ug</span>
            </span>
          </div>
          <p className="text-sm opacity-70 leading-relaxed">
            SwiftUg is the global shop-and-ship courier. One membership gives you mailboxes
            around the world and door-to-door delivery in 50+ countries.
          </p>
          <p className="text-sm opacity-70 leading-relaxed mt-2 flex items-center gap-1.5">
            <Globe2 className="h-4 w-4 text-accent" /> Mailboxes in USA · UK · UAE · Germany · China · Singapore · Hong Kong
          </p>
        </div>

        <div>
          <h4 className="font-display font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2 text-sm opacity-70">
            {[
              { label: 'Home', path: '/' },
              { label: 'Shop & Ship', path: '/shop-ship' },
              { label: 'Track Parcel', path: '/track' },
              { label: 'Calculate Cost', path: '/calculate' },
              { label: 'About Us', path: '/about' },
              { label: 'Contact', path: '/contact' },
            ].map((link) => (
              <li key={link.path}>
                <Link to={link.path} className="hover:text-accent transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold mb-4">Services</h4>
          <ul className="space-y-2 text-sm opacity-70">
            <li>Shop & Ship Worldwide</li>
            <li>International Mailboxes</li>
            <li>Parcel Consolidation</li>
            <li>International Shipping</li>
            <li>Domestic Express (UG)</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold mb-4">Contact Info</h4>
          <ul className="space-y-3 text-sm opacity-70">
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              Swift Ug Global Operations, Dubai, UAE
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-accent" />
              +971 4 123 4567
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent" />
              care@SwiftUg.com
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-primary-foreground/10 text-center text-sm opacity-50">
        © {new Date().getFullYear()} SwiftUg Global. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;