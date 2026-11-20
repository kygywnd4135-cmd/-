import sys, torch, torch.nn as nn, torch.nn.functional as F, numpy as np
from PIL import Image
class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.conv1=nn.Conv2d(nf,gc,3,1,1); s.conv2=nn.Conv2d(nf+gc,gc,3,1,1)
        s.conv3=nn.Conv2d(nf+2*gc,gc,3,1,1); s.conv4=nn.Conv2d(nf+3*gc,gc,3,1,1)
        s.conv5=nn.Conv2d(nf+4*gc,nf,3,1,1); s.l=nn.LeakyReLU(0.2,True)
    def forward(s,x):
        x1=s.l(s.conv1(x)); x2=s.l(s.conv2(torch.cat((x,x1),1)))
        x3=s.l(s.conv3(torch.cat((x,x1,x2),1))); x4=s.l(s.conv4(torch.cat((x,x1,x2,x3),1)))
        return s.conv5(torch.cat((x,x1,x2,x3,x4),1))*0.2+x
class RRDB(nn.Module):
    def __init__(s,nf=64,gc=32):
        super().__init__(); s.rdb1=RDB(nf,gc); s.rdb2=RDB(nf,gc); s.rdb3=RDB(nf,gc)
    def forward(s,x): return s.rdb3(s.rdb2(s.rdb1(x)))*0.2+x
class Net(nn.Module):
    def __init__(s,nb=6,nf=64):
        super().__init__()
        s.conv_first=nn.Conv2d(3,nf,3,1,1); s.body=nn.Sequential(*[RRDB(nf) for _ in range(nb)])
        s.conv_body=nn.Conv2d(nf,nf,3,1,1); s.conv_up1=nn.Conv2d(nf,nf,3,1,1); s.conv_up2=nn.Conv2d(nf,nf,3,1,1)
        s.conv_hr=nn.Conv2d(nf,nf,3,1,1); s.conv_last=nn.Conv2d(nf,3,3,1,1); s.l=nn.LeakyReLU(0.2,True)
    def forward(s,x):
        f=s.conv_first(x); f=f+s.conv_body(s.body(f))
        f=s.l(s.conv_up1(F.interpolate(f,scale_factor=2,mode='nearest')))
        f=s.l(s.conv_up2(F.interpolate(f,scale_factor=2,mode='nearest')))
        return s.conv_last(s.l(s.conv_hr(f)))
torch.set_num_threads(max(1,torch.get_num_threads()))
m=Net(); sd=torch.load(sys.argv[1],map_location='cpu'); sd=sd.get('params_ema',sd.get('params',sd))
m.load_state_dict(sd,strict=True); m.eval()
img=np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(np.float32)/255
H,W,_=img.shape; T=192; P=12; out=np.zeros((H*4,W*4,3),np.float32)
x=torch.from_numpy(img).permute(2,0,1)[None]
tiles=[(y,xx) for y in range(0,H,T) for xx in range(0,W,T)]
with torch.no_grad():
    for i,(y,xx) in enumerate(tiles):
        y0,x0=max(y-P,0),max(xx-P,0); y1,x1=min(y+T+P,H),min(xx+T+P,W)
        o=m(x[:,:,y0:y1,x0:x1])[0].permute(1,2,0).numpy()
        ty,tx=(y-y0)*4,(xx-x0)*4; h,w=min(T,H-y)*4,min(T,W-xx)*4
        out[y*4:y*4+h,xx*4:xx*4+w]=o[ty:ty+h,tx:tx+w]
        print(f'{i+1}/{len(tiles)}',flush=True)
Image.fromarray((np.clip(out,0,1)*255).round().astype(np.uint8)).save(sys.argv[3])
print('saved')
