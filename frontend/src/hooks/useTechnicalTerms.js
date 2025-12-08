
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export const useTechnicalTerms = () => {
  const { i18n } = useTranslation();
  const [terms, setTerms] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await axios.get(`${API_URL}/translations/combined`);
        setTerms(res.data);
      } catch (err) {
        console.error('Failed to fetch terms', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTerms();
  }, []);

  const t_tech = (key) => {
    if (i18n.language === 'ar') {
        return terms[key] || key;
    }
    return key; // English is the key
  };

  return { t_tech, terms, loading };
};
