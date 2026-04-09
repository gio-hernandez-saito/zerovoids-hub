import { useFrame, useThree } from '@react-three/fiber';

export default function VoidCamera() {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.025) * Math.cos(t * 0.018) * 0.3;
    camera.position.y = Math.cos(t * 0.032) * 0.15;
    camera.lookAt(0, 0, 0);
  });

  return null;
}
