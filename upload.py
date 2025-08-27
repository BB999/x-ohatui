import os
import sys
import fal_client as fal

try:
    if not os.getenv('FAL_KEY'):
        print('Error: FAL_KEY not found')
        sys.exit(1)
    if not os.path.exists('morning-image.png'):
        print('Error: morning-image.png not found') 
        sys.exit(1)
    print('Uploading to FAL...')
    with open('morning-image.png', 'rb') as f:
        url = fal.upload(f.read(), 'image/png')
    print('Upload successful:', url)
    with open('fal_url.txt', 'w') as f:
        f.write(url)
except Exception as e:
    print('Error:', str(e))
    sys.exit(1)