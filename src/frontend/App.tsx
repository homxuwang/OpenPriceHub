import DeveloperSubmit from './pages/DeveloperSubmit';
import WebsiteAdmin from './pages/WebsiteAdmin';
import WebsitePrices from './pages/WebsitePrices';
// OpenPriceHub · App — /:lang 路由 + 全局 Provider

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { LocaleProvider, isLocale, type Locale } from './i18n';
import { CurrencyProvider } from './context/CurrencyProvider';
import { CompareProvider } from './context/CompareContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Tools from './pages/Tools';
import AudioCompare from './pages/AudioCompare';
import DiscoveryLab from './pages/DiscoveryLab';
function ToolsEntry() {
  const [params] = useSearchParams();
  const category = params.get('category');
  return category === 'voice' || category === 'tts' ? <AudioCompare key="voice" kind="voice" /> : category === 'music' ? <AudioCompare key="music" kind="music" /> : <Tools />;
}
import Submit from './pages/Submit';
import Soon from './pages/Soon';
import ManualCompareWorkspace from './pages/ManualCompareWorkspace';

// 同步 <html lang>
function LocaleSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  }, [locale]);
  return null;
}

function LocaleShell() {
  const { lang } = useParams();
  if (!isLocale(lang)) return <Navigate to="/zh" replace />;

  return (
    <LocaleProvider locale={lang}>
      <CurrencyProvider initial={lang === 'en' ? 'USD' : 'CNY'}>
        <CompareProvider>
          <LocaleSync locale={lang} />
          <Layout>
            <Routes>
              <Route index element={<Home />} />
              <Route path="discovery-lab" element={<DiscoveryLab />} />
              <Route path="tools" element={<ToolsEntry />} />
              <Route path="tools/:slug" element={<Soon />} />
              <Route path="compare" element={<Soon />} />
              <Route path="compare/tts" element={<AudioCompare key="voice" kind="voice" />} />
              <Route path="compare/music" element={<AudioCompare key="music" kind="music" />} />
              <Route path="calculator/voice" element={<AudioCompare key="voice" kind="voice" />} />
              <Route path="calculator/music" element={<AudioCompare key="music" kind="music" />} />
              <Route path="calculator" element={<ManualCompareWorkspace />} />
              <Route path="manual-compare" element={<ManualCompareWorkspace />} />
              <Route path="guides" element={<Soon />} />
              <Route path="submit" element={<Submit />} />
              <Route path="submit/website" element={<DeveloperSubmit />} />
              <Route path="websites" element={<WebsitePrices />} />
              <Route path="about" element={<Soon />} />
              <Route path="admin" element={<WebsiteAdmin />} />
              <Route path="*" element={<Soon />} />
            </Routes>
          </Layout>
        </CompareProvider>
      </CurrencyProvider>
    </LocaleProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/zh" replace />} />
        <Route path="/manual-compare" element={<Navigate to="/zh/manual-compare" replace />} />
        <Route path="/compare/tts" element={<Navigate to="/zh/compare/tts" replace />} />
        <Route path="/compare/music" element={<Navigate to="/zh/compare/music" replace />} />
        <Route path="/:lang/*" element={<LocaleShell />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
