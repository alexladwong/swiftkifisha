import { motion } from 'framer-motion';
import { Zap, Shield, Cpu, Heart, Truck, Globe, Boxes, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

const values = [
  { icon: Zap, titleKey: 'about.valueSpeed', descKey: 'about.valueSpeedDesc' },
  { icon: Shield, titleKey: 'about.valueTrust', descKey: 'about.valueTrustDesc' },
  { icon: Cpu, titleKey: 'about.valueTech', descKey: 'about.valueTechDesc' },
  { icon: Heart, titleKey: 'about.valueCare', descKey: 'about.valueCareDesc' },
];

const stats = [
  { value: '2M+', labelKey: 'about.statParcels' },
  { value: '7', labelKey: 'about.statHubs' },
  { value: '50+', labelKey: 'about.statCountries' },
  { value: '99%', labelKey: 'about.statOnTime' },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const About = () => {
  const { t } = useI18n();
  return (
    <div className="min-h-screen pb-20 pt-8 md:pt-14">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground">{t('about.title')}</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{t('about.subtitle')}</p>
        </motion.div>

        <motion.section {...fadeUp} className="max-w-3xl mx-auto mb-20">
          <h2 className="font-display text-2xl font-bold text-foreground mb-4">{t('about.storyTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">{t('about.story1')}</p>
          <p className="text-muted-foreground leading-relaxed mb-4">{t('about.story2')}</p>
          <p className="text-muted-foreground leading-relaxed">{t('about.story3')}</p>
        </motion.section>

        <div className="grid md:grid-cols-2 gap-8 mb-20">
          <motion.div {...fadeUp}>
            <Card className="h-full border-border/50 shadow-sm">
              <CardContent className="p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                  <Truck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-3">{t('about.missionTitle')}</h3>
                <p className="text-muted-foreground">{t('about.missionDesc')}</p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
            <Card className="h-full border-border/50 shadow-sm">
              <CardContent className="p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 mb-4">
                  <Globe className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-3">{t('about.visionTitle')}</h3>
                <p className="text-muted-foreground">{t('about.visionDesc')}</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div {...fadeUp} className="mb-20">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-8 text-center">
              <MapPin className="h-7 w-7 text-accent mx-auto mb-3" />
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">{t('about.hubsTitle')}</h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">{t('about.hubsDesc')}</p>
              <Link to="/shop-ship">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                  <Boxes className="mr-2 h-4 w-4" /> {t('about.exploreCta')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp} className="text-center mb-10">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t('about.valuesTitle')}</h2>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((v, i) => (
            <motion.div
              key={v.titleKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <Card className="h-full border-border/50 shadow-sm text-center">
                <CardContent className="p-6">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                    <v.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-2">{t(v.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground">{t(v.descKey)}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div {...fadeUp} className="mt-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.labelKey} className="text-center">
                <p className="font-display text-3xl md:text-4xl font-bold text-primary">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{t(s.labelKey)}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default About;
