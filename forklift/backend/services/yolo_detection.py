"""
YOLOv5 Forklift Detection Service
Kaggle notebook benzeri YOLO tabanlı forklift, çatal ve yük tespiti
"""

import os
import sys
import json
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from PIL import Image
import io

app = Flask(__name__)
CORS(app)

# YOLO model yolu (model dosyası buraya yerleştirilecek)
MODEL_PATH = os.getenv('YOLO_MODEL_PATH', './models/forklift_yolov5.pt')
CONFIDENCE_THRESHOLD = 0.4

# YOLO modelini yükle (eğer mevcut ise)
MODEL_LOADED = False
model = None

try:
    import torch
    
    # Önce YOLOv8 (ultralytics) dene
    try:
        from ultralytics import YOLO
        if os.path.exists(MODEL_PATH):
            model = YOLO(MODEL_PATH)
            MODEL_LOADED = True
            print(f"YOLOv8 modeli yüklendi: {MODEL_PATH}")
        else:
            # Varsayılan YOLOv8 modelini dene
            try:
                model = YOLO('yolov8n.pt')  # Nano model
                MODEL_LOADED = True
                print("Varsayılan YOLOv8n modeli yüklendi (eğitilmemiş)")
            except:
                pass
    except ImportError:
        pass
    
    # YOLOv5 için alternatif
    if not MODEL_LOADED:
        try:
            import yolov5
            if os.path.exists(MODEL_PATH):
                model = yolov5.load(MODEL_PATH)
                MODEL_LOADED = True
                print(f"YOLOv5 modeli yüklendi: {MODEL_PATH}")
        except ImportError:
            pass
    
    if not MODEL_LOADED:
        print("YOLO modeli bulunamadı. Klasik CV kullanılacak.")
        print(f"Model yolu: {MODEL_PATH}")
        print("Model dosyasını backend/models/ klasörüne yerleştirin.")
        
except ImportError as e:
    print(f"YOLO kütüphaneleri yüklü değil: {e}")
    print("Klasik CV kullanılacak. YOLO için: pip install ultralytics yolov5")

def detect_with_yolo(image_path):
    """
    YOLO modeli ile forklift, çatal ve yük tespiti
    """
    if not MODEL_LOADED or model is None:
        return None
    
    try:
        detections = {
            'forklift': [],
            'fork': [],
            'load': [],
            'person': []
        }
        
        # YOLOv8 (ultralytics) kullanımı
        if hasattr(model, 'predict'):
            results = model.predict(image_path, conf=CONFIDENCE_THRESHOLD, verbose=False)
            
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    
                    # Class isimlerine göre kategorize et
                    class_name = result.names[cls]
                    
                    detection = {
                        'bbox': [x1, y1, x2, y2],
                        'confidence': conf,
                        'class': class_name
                    }
                    
                    if 'forklift' in class_name.lower():
                        detections['forklift'].append(detection)
                    elif 'fork' in class_name.lower() or 'tine' in class_name.lower():
                        detections['fork'].append(detection)
                    elif 'load' in class_name.lower() or 'pallet' in class_name.lower() or 'cargo' in class_name.lower():
                        detections['load'].append(detection)
                    elif 'person' in class_name.lower():
                        detections['person'].append(detection)
        
        # YOLOv5 kullanımı
        elif hasattr(model, '__call__'):
            results = model(image_path, size=640)
            predictions = results.pandas().xyxy[0]
            
            for _, pred in predictions.iterrows():
                class_name = pred['name']
                conf = pred['confidence']
                x1, y1, x2, y2 = pred['xmin'], pred['ymin'], pred['xmax'], pred['ymax']
                
                detection = {
                    'bbox': [x1, y1, x2, y2],
                    'confidence': conf,
                    'class': class_name
                }
                
                if 'forklift' in class_name.lower():
                    detections['forklift'].append(detection)
                elif 'fork' in class_name.lower() or 'tine' in class_name.lower():
                    detections['fork'].append(detection)
                elif 'load' in class_name.lower() or 'pallet' in class_name.lower() or 'cargo' in class_name.lower():
                    detections['load'].append(detection)
                elif 'person' in class_name.lower():
                    detections['person'].append(detection)
        
        return detections
    except Exception as e:
        print(f"YOLO tespit hatası: {e}")
        import traceback
        traceback.print_exc()
        return None

def detect_with_classic_cv(image_path):
    """
    Klasik Computer Vision ile forklift, çatal ve yük tespiti
    YOLO modeli yoksa bu kullanılır
    """
    img = cv2.imread(image_path)
    if img is None:
        return None
    
    height, width = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    detections = {
        'forklift': [],
        'fork': [],
        'load': []
    }
    
    # 1. Forklift tespiti (tüm görsel)
    forklift_bbox = [0, 0, width, height]
    forklift_score = 0.85  # Varsayılan skor
    detections['forklift'].append({
        'bbox': forklift_bbox,
        'confidence': forklift_score,
        'class': 'forklift'
    })
    
    # 2. Çatal tespiti (alt-orta bölge)
    fork_x = int(width * 0.30)
    fork_y = int(height * 0.60)
    fork_w = int(width * 0.40)
    fork_h = int(height * 0.25)
    fork_bbox = [fork_x, fork_y, fork_x + fork_w, fork_y + fork_h]
    
    # Çatal bölgesinde kenar tespiti
    fork_region = gray[fork_y:fork_y+fork_h, fork_x:fork_x+fork_w]
    edges = cv2.Canny(fork_region, 50, 150)
    edge_ratio = np.sum(edges > 0) / (fork_w * fork_h)
    
    fork_score = min(0.9, 0.5 + edge_ratio * 2)
    detections['fork'].append({
        'bbox': fork_bbox,
        'confidence': fork_score,
        'class': 'fork'
    })
    
    # 3. Yük tespiti (çatalların üstünde)
    load_x = fork_x
    load_y = max(0, fork_y - int(fork_h * 0.3))
    load_w = fork_w
    load_h = int(fork_h * 0.25)
    load_bbox = [load_x, load_y, load_x + load_w, load_y + load_h]
    
    # Yük bölgesi analizi
    load_region = gray[load_y:load_y+load_h, load_x:load_x+load_w]
    avg_brightness = np.mean(load_region)
    fork_avg_brightness = np.mean(fork_region)
    
    brightness_diff = fork_avg_brightness - avg_brightness
    load_score = 0.3
    if brightness_diff > 30:
        load_score = min(0.8, 0.3 + (brightness_diff - 30) / 50)
    
    detections['load'].append({
        'bbox': load_bbox,
        'confidence': load_score,
        'class': 'load'
    })
    
    return detections

def calculate_iou(box1, box2):
    """
    Intersection Over Union (IOU) hesapla
    box format: [x1, y1, x2, y2]
    """
    x1_1, y1_1, x2_1, y2_1 = box1
    x1_2, y1_2, x2_2, y2_2 = box2
    
    # Intersection alanı
    x1_i = max(x1_1, x1_2)
    y1_i = max(y1_1, y1_2)
    x2_i = min(x2_1, x2_2)
    y2_i = min(y2_1, y2_2)
    
    if x2_i <= x1_i or y2_i <= y1_i:
        return 0.0
    
    intersection_area = (x2_i - x1_i) * (y2_i - y1_i)
    
    # Union alanı
    box1_area = (x2_1 - x1_1) * (y2_1 - y1_1)
    box2_area = (x2_2 - x1_2) * (y2_2 - y1_2)
    union_area = box1_area + box2_area - intersection_area
    
    if union_area == 0:
        return 0.0
    
    iou = intersection_area / union_area
    return iou

def analyze_forklift_status(detections):
    """
    🧠 2 AŞAMALI ALGORİTMA:
    Aşama 1 → Nesne Tespiti (YOLO tarafından yapıldı)
    Aşama 2 → Mantıksal Karar (IOU tabanlı)
    
    Kural: IOU(fork_box, load_box) > 0.3 ise DOLU
    """
    if not detections:
        return {
            'status': 'unknown',
            'confidence': 0.0,
            'reason': 'Tespit yapılamadı',
            'method': 'none'
        }
    
    # Aşama 1: Nesne Tespiti Kontrolü
    forklifts = detections.get('forklift', [])
    forks = detections.get('fork', [])
    loads = detections.get('load', [])
    
    # Forklift tespit edilmeli
    if not forklifts:
        return {
            'status': 'unknown',
            'confidence': 0.0,
            'reason': 'Forklift tespit edilemedi',
            'method': 'yolo'
        }
    
    best_forklift = max(forklifts, key=lambda x: x['confidence'])
    
    # Çatal tespit edilmeli (KRİTİK)
    if not forks:
        return {
            'status': 'unknown',
            'confidence': 0.0,
            'reason': 'Çatal tespit edilemedi',
            'method': 'yolo',
            'forklift_detected': best_forklift['confidence'] > 0.5
        }
    
    best_fork = max(forks, key=lambda x: x['confidence'])
    
    # Aşama 2: Mantıksal Karar (IOU tabanlı)
    IOU_THRESHOLD = 0.3  # Önerilen eşik değeri
    
    has_load = False
    load_confidence = 0.0
    best_load = None
    iou_value = 0.0
    
    if loads:
        # En yüksek güven skorlu yükü al
        best_load = max(loads, key=lambda x: x['confidence'])
        load_confidence = best_load['confidence']
        
        # IOU hesapla: fork ve load arasındaki örtüşme
        fork_bbox = best_fork['bbox']
        load_bbox = best_load['bbox']
        
        iou_value = calculate_iou(fork_bbox, load_bbox)
        
        # 🧠 MANTIKSAL KARAR: IOU > 0.3 ise yük çatalın üzerinde
        if iou_value > IOU_THRESHOLD:
            has_load = True
        else:
            # IOU düşük ama yük çatalın hemen üstünde olabilir
            # Yük çatalın üstünde mi kontrol et (dikey pozisyon)
            fork_y_center = (fork_bbox[1] + fork_bbox[3]) / 2
            load_y_center = (load_bbox[1] + load_bbox[3]) / 2
            
            # Yük çatalın üstünde ve X pozisyonu yakınsa
            if (load_y_center < fork_y_center and  # Yük çatallardan yukarıda
                abs(load_bbox[0] - fork_bbox[0]) < (fork_bbox[2] - fork_bbox[0]) * 0.5 and  # X pozisyonu yakın
                abs(load_bbox[2] - fork_bbox[2]) < (fork_bbox[2] - fork_bbox[0]) * 0.5):
                # Yük yüksek güven skorlu ise kabul et
                if load_confidence > 0.6:
                    has_load = True
                    iou_value = 0.25  # Düşük IOU ama mantıksal olarak doğru
    else:
        # Yük tespit edilmedi = BOŞ
        has_load = False
    
    # Final durum
    status = 'loaded' if has_load else 'empty'
    
    # Güven skoru hesaplama
    base_confidence = (best_forklift['confidence'] * 0.2 + 
                      best_fork['confidence'] * 0.4)
    
    if has_load and best_load:
        # Yük varsa: IOU ve yük güven skorunu ekle
        iou_weight = min(iou_value * 2, 0.4)  # IOU'yu ağırlıklandır
        load_weight = best_load['confidence'] * 0.4
        confidence = base_confidence + iou_weight + load_weight
    else:
        # Yük yoksa: çatal güven skoruna göre
        confidence = base_confidence + (1 - best_fork['confidence']) * 0.4
    
    confidence = min(0.95, max(0.3, confidence))
    
    return {
        'status': status,
        'confidence': confidence,
        'forklift_detected': best_forklift['confidence'] > 0.5,
        'fork_detected': best_fork['confidence'] > 0.5,
        'load_detected': has_load,
        'iou_value': iou_value,
        'iou_threshold': IOU_THRESHOLD,
        'detections': detections,
        'method': 'yolo_iou',
        'reason': f'IOU: {iou_value:.2f}, Threshold: {IOU_THRESHOLD}'
    }

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': MODEL_LOADED,
        'model_path': MODEL_PATH
    })

@app.route('/detect', methods=['POST'])
def detect():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'Görsel dosyası yüklenmedi'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'Dosya seçilmedi'}), 400
        
        # Geçici dosya olarak kaydet
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            file.save(tmp_file.name)
            image_path = tmp_file.name
        
        try:
            # YOLO ile tespit et (varsa)
            detections = detect_with_yolo(image_path)
            
            # YOLO yoksa klasik CV kullan
            if detections is None:
                detections = detect_with_classic_cv(image_path)
            
            # Forklift durumunu analiz et
            result = analyze_forklift_status(detections)
            
            # Görseli işle ve bounding box'ları çiz
            img = cv2.imread(image_path)
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Bounding box'ları çiz
            if detections:
                # Forklift
                for forklift in detections.get('forklift', []):
                    bbox = forklift['bbox']
                    cv2.rectangle(img_rgb, 
                                (int(bbox[0]), int(bbox[1])), 
                                (int(bbox[2]), int(bbox[3])), 
                                (0, 0, 255), 3)
                    cv2.putText(img_rgb, f"Forklift {forklift['confidence']:.0%}", 
                              (int(bbox[0]), int(bbox[1]) - 10),
                              cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                
                # Çatal
                for fork in detections.get('fork', []):
                    bbox = fork['bbox']
                    cv2.rectangle(img_rgb, 
                                (int(bbox[0]), int(bbox[1])), 
                                (int(bbox[2]), int(bbox[3])), 
                                (255, 165, 0), 3)
                    cv2.putText(img_rgb, f"Fork {fork['confidence']:.0%}", 
                              (int(bbox[0]), int(bbox[1]) - 10),
                              cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 165, 0), 2)
                
                # Yük
                for load in detections.get('load', []):
                    bbox = load['bbox']
                    color = (0, 255, 0) if result['load_detected'] else (255, 0, 0)
                    cv2.rectangle(img_rgb, 
                                (int(bbox[0]), int(bbox[1])), 
                                (int(bbox[2]), int(bbox[3])), 
                                color, 3)
                    status_text = "LOADED" if result['load_detected'] else "EMPTY"
                    cv2.putText(img_rgb, f"{status_text} {load['confidence']:.0%}", 
                              (int(bbox[0]), int(bbox[1]) - 10),
                              cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            
            # İşlenmiş görseli base64'e çevir
            _, buffer = cv2.imencode('.jpg', cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR))
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            return jsonify({
                'success': True,
                'status': result['status'],
                'confidence': result['confidence'],
                'forklift_detected': result['forklift_detected'],
                'fork_detected': result['fork_detected'],
                'load_detected': result['load_detected'],
                'iou_value': result.get('iou_value', 0.0),
                'iou_threshold': result.get('iou_threshold', 0.3),
                'method': result.get('method', 'yolo_iou'),
                'reason': result.get('reason', ''),
                'detections': detections,
                'processed_image': f"data:image/jpeg;base64,{img_base64}",
                'bounding_boxes': {
                    'forklift': detections.get('forklift', [{}])[0].get('bbox', []) if detections.get('forklift') else [],
                    'fork': detections.get('fork', [{}])[0].get('bbox', []) if detections.get('fork') else [],
                    'load': detections.get('load', [{}])[0].get('bbox', []) if detections.get('load') else []
                }
            })
        finally:
            # Geçici dosyayı sil
            if os.path.exists(image_path):
                os.unlink(image_path)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('YOLO_SERVICE_PORT', 5006))
    app.run(host='0.0.0.0', port=port, debug=False)

