import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, MapPin, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n';

const contactInfo = [
  { icon: MapPin, labelKey: 'contact.infoAddress', value: 'SwiftKifisha Global Operations, Business Bay, Dubai, United Arab Emirates' },
  { icon: Phone, labelKey: 'contact.infoPhone', value: '+971 4 123 4567' },
  { icon: Mail, labelKey: 'contact.infoEmail', value: 'care@SwiftKifisha.com' },
];

const Contact = () => {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast({ title: t('contact.toastMissingTitle'), description: t('contact.toastMissingDesc'), variant: 'destructive' });
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast({ title: t('contact.toastSentTitle'), description: t('contact.toastSentDesc') });
      setForm({ name: '', email: '', phone: '', message: '' });
    }, 1500);
  };

  return (
    <div className="min-h-screen pb-20 pt-8 md:pt-14">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">{t('contact.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('contact.subtitle')}</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-6 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('contact.labelName')}</Label>
                      <Input placeholder={t('contact.placeholderName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('contact.labelEmail')}</Label>
                      <Input type="email" placeholder={t('contact.placeholderEmail')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('contact.labelPhone')}</Label>
                    <Input placeholder={t('contact.placeholderPhone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('contact.labelMessage')}</Label>
                    <Textarea rows={5} placeholder={t('contact.placeholderMessage')} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                  </div>
                  <Button type="submit" disabled={sending} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                    {sending ? t('contact.sending') : <><Send className="mr-2 h-4 w-4" /> {t('contact.sendMessage')}</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            {contactInfo.map((item) => (
              <Card key={item.labelKey} className="border-border/50 shadow-sm">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-sm text-foreground">{t(item.labelKey)}</p>
                    <p className="text-sm text-muted-foreground">{item.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Map placeholder */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <div className="h-48 bg-muted flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('contact.mapTitle')}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
