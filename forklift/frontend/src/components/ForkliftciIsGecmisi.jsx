import React, { useState, useEffect } from 'react'
import apiClient from '../utils/axiosConfig'
import { useAuth } from '../context/AuthContext'
import './ForkliftciIsGecmisi.css'

function ForkliftciIsGecmisi() {
  const { user } = useAuth()
  const [isler, setIsler] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtreler, setFiltreler] = useState({
    baslangic_tarihi: '',
    bitis_tarihi: '',
    durum: 'tamamlanan' // onaylandi, reddedildi, tamamlanan
  })

  useEffect(() => {
    if (user) {
      fetchIsGecmisi()
    }
  }, [user, filtreler])

  const fetchIsGecmisi = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (filtreler.baslangic_tarihi) {
        params.append('baslangic_tarihi', filtreler.baslangic_tarihi)
      }
      if (filtreler.bitis_tarihi) {
        params.append('bitis_tarihi', filtreler.bitis_tarihi)
      }
      if (filtreler.durum) {
        params.append('durum', filtreler.durum)
      }
      
      const url = `/api/forklift/bildirimler/gecmis?${params.toString()}`
      const response = await apiClient.get(url)
      setIsler(response.data)
      setLoading(false)
    } catch (error) {
      console.error('İş geçmişi yükleme hatası:', error)
      setLoading(false)
    }
  }

  const handleFiltreDegis = (key, value) => {
    setFiltreler(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const exportToCSV = () => {
    if (isler.length === 0) {
      alert('Dışa aktarılacak veri yok')
      return
    }

    // CSV başlıkları
    const headers = ['Tarih', 'Saat', 'İş İstasyonu', 'Mesaj', 'Durum', 'Süre', 'Oluşturulma Tarihi']
    
    // CSV satırları
    const rows = isler.map(is => {
      const tarih = new Date(is.onay_tarihi || is.olusturma_tarihi)
      const sure = is.sure_saniye ? formatSure(is.sure_saniye) : '-'
      return [
        tarih.toLocaleDateString('tr-TR'),
        tarih.toLocaleTimeString('tr-TR'),
        is.workstation_adi || 'Bilinmiyor',
        is.mesaj || '',
        is.durum === 'onaylandi' ? 'Onaylandı' : is.durum === 'reddedildi' ? 'Reddedildi' : 'Beklemede',
        sure,
        new Date(is.olusturma_tarihi).toLocaleString('tr-TR')
      ]
    })

    // CSV içeriği oluştur
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // BOM ekle (Excel için Türkçe karakter desteği)
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    
    // İndirme linki oluştur
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    
    // Dosya adı oluştur
    const tarih = new Date().toISOString().split('T')[0]
    link.setAttribute('download', `forkliftci_is_gecmisi_${tarih}.csv`)
    
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToExcel = () => {
    // Basit Excel formatı (HTML table olarak)
    if (isler.length === 0) {
      alert('Dışa aktarılacak veri yok')
      return
    }

    let html = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h2>Forkliftçi İş Geçmişi - ${user.ad_soyad}</h2>
          <p>Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}</p>
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Saat</th>
                <th>İş İstasyonu</th>
                <th>Mesaj</th>
                <th>Durum</th>
                <th>Süre</th>
                <th>Oluşturulma Tarihi</th>
              </tr>
            </thead>
            <tbody>
    `

    isler.forEach(is => {
      const tarih = new Date(is.onay_tarihi || is.olusturma_tarihi)
      const durum = is.durum === 'onaylandi' ? 'Onaylandı' : 
                   is.durum === 'reddedildi' ? 'Reddedildi' : 'Beklemede'
      
      html += `
        <tr>
          <td>${tarih.toLocaleDateString('tr-TR')}</td>
          <td>${tarih.toLocaleTimeString('tr-TR')}</td>
          <td>${is.workstation_adi || 'Bilinmiyor'}</td>
          <td>${is.mesaj || ''}</td>
          <td>${durum}</td>
          <td>${is.sure_saniye ? (() => {
            const saat = Math.floor(is.sure_saniye / 3600);
            const dakika = Math.floor((is.sure_saniye % 3600) / 60);
            const saniyeKalan = is.sure_saniye % 60;
            if (saat > 0) return `${saat} sa ${dakika} dk ${saniyeKalan} sn`;
            if (dakika > 0) return `${dakika} dk ${saniyeKalan} sn`;
            return `${saniyeKalan} sn`;
          })() : '-'}</td>
          <td>${new Date(is.olusturma_tarihi).toLocaleString('tr-TR')}</td>
        </tr>
      `
    })

    html += `
            </tbody>
          </table>
        </body>
      </html>
    `

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    const tarih = new Date().toISOString().split('T')[0]
    link.setAttribute('download', `forkliftci_is_gecmisi_${tarih}.xls`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatTarih = (tarih) => {
    if (!tarih) return '-'
    return new Date(tarih).toLocaleString('tr-TR')
  }

  const formatSure = (saniye) => {
    if (!saniye) return '-'
    const saat = Math.floor(saniye / 3600)
    const dakika = Math.floor((saniye % 3600) / 60)
    const saniyeKalan = saniye % 60
    if (saat > 0) {
      return `${saat} sa ${dakika} dk ${saniyeKalan} sn`
    } else if (dakika > 0) {
      return `${dakika} dk ${saniyeKalan} sn`
    }
    return `${saniyeKalan} sn`
  }

  const getDurumBadge = (durum) => {
    if (durum === 'onaylandi') {
      return <span className="durum-badge durum-onaylandi">✅ Onaylandı</span>
    } else if (durum === 'reddedildi') {
      return <span className="durum-badge durum-reddedildi">❌ Reddedildi</span>
    }
    return <span className="durum-badge durum-beklemede">⏳ Beklemede</span>
  }

  if (loading) {
    return <div className="loading">Yükleniyor...</div>
  }

  return (
    <div className="is-gecmisi-container">
      <div className="is-gecmisi-header">
        <h2>İş Geçmişi</h2>
        <div className="is-gecmisi-actions">
          <button className="btn-export btn-export-csv" onClick={exportToCSV}>
            CSV İndir
          </button>
          <button className="btn-export btn-export-excel" onClick={exportToExcel}>
            Excel İndir
          </button>
        </div>
      </div>

      <div className="is-gecmisi-filtreler">
        <div className="filtre-grup">
          <label>Başlangıç Tarihi:</label>
          <input
            type="date"
            value={filtreler.baslangic_tarihi}
            onChange={(e) => handleFiltreDegis('baslangic_tarihi', e.target.value)}
          />
        </div>
        <div className="filtre-grup">
          <label>Bitiş Tarihi:</label>
          <input
            type="date"
            value={filtreler.bitis_tarihi}
            onChange={(e) => handleFiltreDegis('bitis_tarihi', e.target.value)}
          />
        </div>
        <div className="filtre-grup">
          <label>Durum:</label>
          <select
            value={filtreler.durum}
            onChange={(e) => handleFiltreDegis('durum', e.target.value)}
          >
            <option value="tamamlanan">Tümü (Onaylanan + Reddedilen)</option>
            <option value="onaylandi">Onaylanan</option>
            <option value="reddedildi">Reddedilen</option>
          </select>
        </div>
        <button className="btn-filtre-temizle" onClick={() => setFiltreler({
          baslangic_tarihi: '',
          bitis_tarihi: '',
          durum: 'tamamlanan'
        })}>
          Filtreleri Temizle
        </button>
      </div>

      {isler.length === 0 ? (
        <div className="no-is-gecmisi">
          <p>Henüz iş geçmişi bulunmuyor.</p>
        </div>
      ) : (
        <div className="is-gecmisi-tablo-wrapper">
          <table className="is-gecmisi-tablo">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Saat</th>
                <th>İş İstasyonu</th>
                <th>Mesaj</th>
                <th>Durum</th>
                <th>Süre</th>
                <th>Oluşturulma</th>
              </tr>
            </thead>
            <tbody>
              {isler.map((is) => {
                const tarih = new Date(is.onay_tarihi || is.olusturma_tarihi)
                return (
                  <tr key={is.id}>
                    <td>{tarih.toLocaleDateString('tr-TR')}</td>
                    <td>{tarih.toLocaleTimeString('tr-TR')}</td>
                    <td>{is.workstation_adi || 'Bilinmiyor'}</td>
                    <td className="mesaj-cell">{is.mesaj || '-'}</td>
                    <td>{getDurumBadge(is.durum)}</td>
                    <td>{formatSure(is.sure_saniye)}</td>
                    <td>{formatTarih(is.olusturma_tarihi)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="is-gecmisi-istatistik">
        <div className="istatistik-item">
          <span className="istatistik-label">Toplam İş:</span>
          <span className="istatistik-deger">{isler.length}</span>
        </div>
        <div className="istatistik-item">
          <span className="istatistik-label">Onaylanan:</span>
          <span className="istatistik-deger onaylandi">
            {isler.filter(i => i.durum === 'onaylandi').length}
          </span>
        </div>
        <div className="istatistik-item">
          <span className="istatistik-label">Reddedilen:</span>
          <span className="istatistik-deger reddedildi">
            {isler.filter(i => i.durum === 'reddedildi').length}
          </span>
        </div>
      </div>
    </div>
  )
}

export default ForkliftciIsGecmisi

