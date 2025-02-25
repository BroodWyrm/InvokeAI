import { RootState } from 'app/store';
import { useAppDispatch, useAppSelector } from 'app/storeHooks';
import IAISlider from 'common/components/IAISlider';
import { setImg2imgStrength } from 'features/parameters/store/generationSlice';
import { useTranslation } from 'react-i18next';

interface ImageToImageStrengthProps {
  label?: string;
}

export default function ImageToImageStrength(props: ImageToImageStrengthProps) {
  const { t } = useTranslation();
  const { label = `${t('parameters.strength')}` } = props;
  const img2imgStrength = useAppSelector(
    (state: RootState) => state.generation.img2imgStrength
  );
  const isImageToImageEnabled = useAppSelector(
    (state: RootState) => state.generation.isImageToImageEnabled
  );

  const dispatch = useAppDispatch();

  const handleChangeStrength = (v: number) => dispatch(setImg2imgStrength(v));

  const handleImg2ImgStrengthReset = () => {
    dispatch(setImg2imgStrength(0.75));
  };

  return (
    <IAISlider
      label={label}
      step={0.01}
      min={0.01}
      max={1}
      onChange={handleChangeStrength}
      value={img2imgStrength}
      isInteger={false}
      withInput
      withSliderMarks
      inputWidth={22}
      withReset
      handleReset={handleImg2ImgStrengthReset}
      isDisabled={!isImageToImageEnabled}
    />
  );
}
